// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/INotaryRegistry.sol";

/**
 * @title NotaryRegistry
 * @author BaseWill Team
 * @notice Manages notary registration, staking, and reputation for the BaseWill platform
 * @dev Notaries stake ETH to participate in death verification, with slashing for false claims
 *
 * LEGAL DISCLAIMER: Notaries in this system are technical verifiers who cryptographically
 * attest to death verification within the protocol. They are NOT legally recognized notaries
 * in any jurisdiction. Their role is purely technical within the BaseWill ecosystem.
 */
contract NotaryRegistry is INotaryRegistry, Ownable2Step, ReentrancyGuard, Pausable {
    // ============ State Variables ============

    /// @notice Minimum stake required to be a notary
    uint256 public minimumStake;

    /// @notice Cooldown period for stake withdrawal
    uint256 public withdrawalCooldown;

    /// @notice BaseWill contract address (only one that can slash/record)
    address public baseWillContract;

    /// @notice Whether BaseWill contract has been set
    bool public baseWillSet;

    /// @notice Mapping of notary address to their info
    mapping(address => NotaryInfo) private notaries;

    /// @notice Mapping of notary to their verification history
    mapping(address => VerificationRecord[]) private verificationHistory;

    /// @notice Array of all registered notary addresses
    address[] private registeredNotaryList;

    /// @notice Mapping to track index in registeredNotaryList
    mapping(address => uint256) private notaryListIndex;

    /// @notice Total stake across all notaries
    uint256 public totalStaked;

    /// @notice Initial reputation score for new notaries
    uint256 public constant INITIAL_REPUTATION = 50;

    /// @notice Maximum reputation score
    uint256 public constant MAX_REPUTATION = 100;

    /// @notice Reputation increase for successful verification
    uint256 public constant REPUTATION_INCREASE = 2;

    /// @notice Reputation decrease for failed verification (before slashing)
    uint256 public constant REPUTATION_DECREASE = 10;

    // ============ Constructor ============

    /**
     * @notice Initialize the NotaryRegistry
     * @param _minimumStake Minimum ETH stake required
     * @param _withdrawalCooldown Cooldown period in seconds
     */
    constructor(
        uint256 _minimumStake,
        uint256 _withdrawalCooldown
    ) Ownable(msg.sender) {
        require(_minimumStake > 0, "Minimum stake must be > 0");
        require(_withdrawalCooldown >= 1 days, "Cooldown must be >= 1 day");

        minimumStake = _minimumStake;
        withdrawalCooldown = _withdrawalCooldown;
    }

    // ============ Modifiers ============

    /**
     * @notice Only BaseWill contract can call
     */
    modifier onlyBaseWill() {
        require(msg.sender == baseWillContract, "Only BaseWill contract");
        _;
    }

    /**
     * @notice Notary must be registered
     */
    modifier onlyRegisteredNotary() {
        require(notaries[msg.sender].isRegistered, "Not a registered notary");
        _;
    }

    // ============ Core Functions ============

    /**
     * @inheritdoc INotaryRegistry
     */
    function registerNotary() external payable nonReentrant whenNotPaused {
        if (notaries[msg.sender].isRegistered) {
            revert NotaryAlreadyRegistered(msg.sender);
        }

        if (msg.value < minimumStake) {
            revert InsufficientStake(msg.value, minimumStake);
        }

        notaries[msg.sender] = NotaryInfo({
            isRegistered: true,
            stake: msg.value,
            reputationScore: INITIAL_REPUTATION,
            totalVerifications: 0,
            successfulVerifications: 0,
            registrationTime: block.timestamp,
            lastActivityTime: block.timestamp,
            pendingWithdrawal: 0,
            withdrawalRequestTime: 0,
            slashedAmount: 0
        });

        // Add to list
        notaryListIndex[msg.sender] = registeredNotaryList.length;
        registeredNotaryList.push(msg.sender);

        totalStaked += msg.value;

        emit NotaryRegistered(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function increaseStake() external payable onlyRegisteredNotary nonReentrant whenNotPaused {
        if (msg.value == 0) {
            revert ZeroAmount();
        }

        notaries[msg.sender].stake += msg.value;
        totalStaked += msg.value;

        emit StakeIncreased(msg.sender, msg.value, notaries[msg.sender].stake);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function requestWithdrawal(uint256 amount) external onlyRegisteredNotary nonReentrant {
        NotaryInfo storage notary = notaries[msg.sender];

        if (notary.pendingWithdrawal > 0) {
            revert WithdrawalAlreadyPending();
        }

        // Cannot withdraw below minimum stake if remaining registered
        uint256 availableForWithdrawal = notary.stake > minimumStake
            ? notary.stake - minimumStake
            : 0;

        // Unless they're withdrawing everything (deregistering)
        if (amount != notary.stake && amount > availableForWithdrawal) {
            revert InsufficientStakeForWithdrawal(amount, availableForWithdrawal);
        }

        if (amount > notary.stake) {
            revert InsufficientStakeForWithdrawal(amount, notary.stake);
        }

        notary.pendingWithdrawal = amount;
        notary.withdrawalRequestTime = block.timestamp;

        uint256 availableAt = block.timestamp + withdrawalCooldown;

        emit WithdrawalRequested(msg.sender, amount, availableAt);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function completeWithdrawal() external onlyRegisteredNotary nonReentrant {
        NotaryInfo storage notary = notaries[msg.sender];

        if (notary.pendingWithdrawal == 0) {
            revert NoWithdrawalPending();
        }

        uint256 availableAt = notary.withdrawalRequestTime + withdrawalCooldown;
        if (block.timestamp < availableAt) {
            revert CooldownNotComplete(availableAt);
        }

        uint256 amount = notary.pendingWithdrawal;

        // Update state before transfer
        notary.stake -= amount;
        notary.pendingWithdrawal = 0;
        notary.withdrawalRequestTime = 0;
        totalStaked -= amount;

        // If withdrawing entire stake, deregister
        if (notary.stake == 0) {
            _removeNotaryFromList(msg.sender);
            notary.isRegistered = false;
        }

        // Transfer
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed(msg.sender, amount);
        }

        emit WithdrawalCompleted(msg.sender, amount);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function cancelWithdrawal() external onlyRegisteredNotary {
        NotaryInfo storage notary = notaries[msg.sender];

        if (notary.pendingWithdrawal == 0) {
            revert NoWithdrawalPending();
        }

        uint256 amount = notary.pendingWithdrawal;
        notary.pendingWithdrawal = 0;
        notary.withdrawalRequestTime = 0;

        emit WithdrawalCancelled(msg.sender, amount);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function slashNotary(
        address notary,
        uint256 amount,
        string calldata reason,
        uint256 willId,
        address recipient
    ) external onlyBaseWill nonReentrant {
        NotaryInfo storage info = notaries[notary];

        if (!info.isRegistered) {
            revert NotaryNotRegistered(notary);
        }

        if (amount > info.stake) {
            revert SlashAmountExceedsStake(amount, info.stake);
        }

        // Update stake
        info.stake -= amount;
        info.slashedAmount += amount;
        totalStaked -= amount;

        // Decrease reputation
        if (info.reputationScore > REPUTATION_DECREASE) {
            info.reputationScore -= REPUTATION_DECREASE;
        } else {
            info.reputationScore = 0;
        }

        // If slashed below minimum, deregister
        if (info.stake < minimumStake) {
            _removeNotaryFromList(notary);
            info.isRegistered = false;

            emit NotaryRemoved(notary, "Slashed below minimum stake", info.stake);
        }

        // Transfer slashed amount to recipient (usually testator)
        if (amount > 0 && recipient != address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            // Don't revert if transfer fails - we've already slashed
            if (!success) {
                // Could emit event for failed transfer
            }
        }

        emit NotarySlashed(notary, amount, reason, willId);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function recordVerification(
        address notary,
        uint256 willId,
        bytes32 proofHash
    ) external onlyBaseWill {
        NotaryInfo storage info = notaries[notary];

        if (!info.isRegistered) {
            revert NotaryNotRegistered(notary);
        }

        info.totalVerifications++;
        info.lastActivityTime = block.timestamp;

        verificationHistory[notary].push(VerificationRecord({
            willId: willId,
            verificationTime: block.timestamp,
            proofHash: proofHash,
            wasSuccessful: false, // Will be updated when execution completes
            rewardReceived: 0
        }));

        emit VerificationRecorded(notary, willId, proofHash);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function markVerificationSuccessful(
        address notary,
        uint256 willId
    ) external onlyBaseWill {
        NotaryInfo storage info = notaries[notary];

        if (!info.isRegistered) {
            revert NotaryNotRegistered(notary);
        }

        info.successfulVerifications++;

        // Increase reputation (cap at MAX_REPUTATION)
        if (info.reputationScore + REPUTATION_INCREASE <= MAX_REPUTATION) {
            uint256 oldScore = info.reputationScore;
            info.reputationScore += REPUTATION_INCREASE;
            emit ReputationUpdated(notary, oldScore, info.reputationScore, "Successful verification");
        }

        // Update verification history
        VerificationRecord[] storage history = verificationHistory[notary];
        for (uint256 i = history.length; i > 0; i--) {
            if (history[i - 1].willId == willId) {
                history[i - 1].wasSuccessful = true;
                break;
            }
        }
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function distributeReward(
        address notary,
        uint256 willId
    ) external payable onlyBaseWill nonReentrant {
        if (msg.value == 0) {
            revert ZeroAmount();
        }

        NotaryInfo storage info = notaries[notary];

        // Update verification history with reward
        VerificationRecord[] storage history = verificationHistory[notary];
        for (uint256 i = history.length; i > 0; i--) {
            if (history[i - 1].willId == willId) {
                history[i - 1].rewardReceived = msg.value;
                break;
            }
        }

        // Transfer reward
        (bool success, ) = payable(notary).call{value: msg.value}("");
        if (!success) {
            revert TransferFailed(notary, msg.value);
        }

        emit RewardDistributed(notary, willId, msg.value);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function removeNotary(address notary, string calldata reason) external onlyOwner {
        NotaryInfo storage info = notaries[notary];

        if (!info.isRegistered) {
            revert NotaryNotRegistered(notary);
        }

        uint256 remainingStake = info.stake;

        // Remove from list
        _removeNotaryFromList(notary);

        // Update state
        info.isRegistered = false;
        info.stake = 0;
        totalStaked -= remainingStake;

        // Return remaining stake
        if (remainingStake > 0) {
            (bool success, ) = payable(notary).call{value: remainingStake}("");
            if (!success) {
                revert TransferFailed(notary, remainingStake);
            }
        }

        emit NotaryRemoved(notary, reason, remainingStake);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function deregister() external onlyRegisteredNotary nonReentrant {
        NotaryInfo storage info = notaries[msg.sender];

        // Cannot deregister with pending withdrawal
        require(info.pendingWithdrawal == 0, "Complete or cancel pending withdrawal first");

        uint256 remainingStake = info.stake;

        // Remove from list
        _removeNotaryFromList(msg.sender);

        // Update state
        info.isRegistered = false;
        info.stake = 0;
        totalStaked -= remainingStake;

        // Return stake
        if (remainingStake > 0) {
            (bool success, ) = payable(msg.sender).call{value: remainingStake}("");
            if (!success) {
                revert TransferFailed(msg.sender, remainingStake);
            }
        }

        emit NotaryRemoved(msg.sender, "Voluntary deregistration", remainingStake);
    }

    // ============ Admin Functions ============

    /**
     * @inheritdoc INotaryRegistry
     */
    function setMinimumStake(uint256 newMinimum) external onlyOwner {
        require(newMinimum > 0, "Minimum must be > 0");

        uint256 oldMinimum = minimumStake;
        minimumStake = newMinimum;

        emit MinimumStakeUpdated(oldMinimum, newMinimum);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function setWithdrawalCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown >= 1 days, "Cooldown must be >= 1 day");

        uint256 oldCooldown = withdrawalCooldown;
        withdrawalCooldown = newCooldown;

        emit WithdrawalCooldownUpdated(oldCooldown, newCooldown);
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function setBaseWillContract(address baseWill) external onlyOwner {
        require(!baseWillSet, "BaseWill already set");
        require(baseWill != address(0), "Cannot be zero address");

        baseWillContract = baseWill;
        baseWillSet = true;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @inheritdoc INotaryRegistry
     */
    function getNotaryInfo(address notary) external view returns (NotaryInfo memory info) {
        return notaries[notary];
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function isActiveNotary(address notary) external view returns (bool isActive) {
        NotaryInfo storage info = notaries[notary];
        return info.isRegistered && info.stake >= minimumStake;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getVerificationHistory(address notary) external view returns (VerificationRecord[] memory records) {
        return verificationHistory[notary];
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getNotaryCount() external view returns (uint256 count) {
        return registeredNotaryList.length;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getRegisteredNotaries(uint256 offset, uint256 limit) external view returns (address[] memory notaryAddresses) {
        uint256 total = registeredNotaryList.length;

        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 resultLength = end - offset;
        notaryAddresses = new address[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            notaryAddresses[i] = registeredNotaryList[offset + i];
        }

        return notaryAddresses;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getTopNotaries(uint256 count) external view returns (address[] memory topNotaries) {
        uint256 total = registeredNotaryList.length;
        uint256 resultCount = count > total ? total : count;

        // Create array of all notaries with scores
        address[] memory allNotaries = new address[](total);
        uint256[] memory scores = new uint256[](total);

        for (uint256 i = 0; i < total; i++) {
            allNotaries[i] = registeredNotaryList[i];
            scores[i] = notaries[registeredNotaryList[i]].reputationScore;
        }

        // Simple bubble sort for top N (not gas efficient for large lists)
        for (uint256 i = 0; i < resultCount; i++) {
            for (uint256 j = i + 1; j < total; j++) {
                if (scores[j] > scores[i]) {
                    // Swap
                    (allNotaries[i], allNotaries[j]) = (allNotaries[j], allNotaries[i]);
                    (scores[i], scores[j]) = (scores[j], scores[i]);
                }
            }
        }

        // Return top N
        topNotaries = new address[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            topNotaries[i] = allNotaries[i];
        }

        return topNotaries;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getMinimumStake() external view returns (uint256 minimum) {
        return minimumStake;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getWithdrawalCooldown() external view returns (uint256 cooldown) {
        return withdrawalCooldown;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getTotalStake() external view returns (uint256 stake) {
        return totalStaked;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function hasPendingVerification(address notary, uint256 willId) external view returns (bool hasPending) {
        VerificationRecord[] storage history = verificationHistory[notary];

        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].willId == willId && !history[i].wasSuccessful && history[i].rewardReceived == 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @inheritdoc INotaryRegistry
     */
    function getPendingVerificationCount(address notary) external view returns (uint256 count) {
        VerificationRecord[] storage history = verificationHistory[notary];

        for (uint256 i = 0; i < history.length; i++) {
            if (!history[i].wasSuccessful && history[i].rewardReceived == 0) {
                count++;
            }
        }

        return count;
    }

    // ============ Internal Functions ============

    /**
     * @notice Remove notary from the registered list
     * @param notary Notary address to remove
     */
    function _removeNotaryFromList(address notary) internal {
        uint256 index = notaryListIndex[notary];
        uint256 lastIndex = registeredNotaryList.length - 1;

        if (index != lastIndex) {
            address lastNotary = registeredNotaryList[lastIndex];
            registeredNotaryList[index] = lastNotary;
            notaryListIndex[lastNotary] = index;
        }

        registeredNotaryList.pop();
        delete notaryListIndex[notary];
    }

    // ============ Receive ============

    /**
     * @notice Receive ETH (for reward distribution)
     */
    receive() external payable {}
}
