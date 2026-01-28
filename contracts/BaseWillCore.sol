// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BaseWillCore
 * @notice Decentralized inheritance platform on Base - core functionality
 */
contract BaseWillCore is ReentrancyGuard, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // Enums & Structs
    // ============================================

    enum WillStatus { Draft, Active, InGracePeriod, Executed, Cancelled }
    enum VestingType { Immediate, Linear, Cliff }

    struct Will {
        address testator;
        WillStatus status;
        uint256 inactivityThreshold;
        uint256 lastActivityTime;
        uint256 gracePeriod;
        uint256 triggeredAt;
        uint256 totalValue;
        uint256 requiredNotaries;
        uint256 verificationCount;
    }

    struct Beneficiary {
        address addr;
        uint256 allocationBps;  // Basis points (100 = 1%)
        VestingType vestingType;
        uint256 vestingDuration;
        uint256 amountClaimed;
    }

    // ============================================
    // Events
    // ============================================

    event WillCreated(uint256 indexed willId, address indexed testator, uint256 inactivityThreshold);
    event WillCancelled(uint256 indexed willId);
    event WillTriggered(uint256 indexed willId, uint256 gracePeriodEnd);
    event WillExecuted(uint256 indexed willId, uint256 distributed);
    event TriggerCancelled(uint256 indexed willId);
    event BeneficiaryAdded(uint256 indexed willId, address indexed beneficiary, uint256 allocationBps);
    event BeneficiaryRemoved(uint256 indexed willId, address indexed beneficiary);
    event CheckIn(uint256 indexed willId, address indexed by);
    event ActivityRecorded(uint256 indexed willId, uint256 timestamp);
    event AssetDeposited(uint256 indexed willId, address indexed token, uint256 amount);
    event AssetDistributed(uint256 indexed willId, address indexed beneficiary, uint256 amount);
    event NotaryVerification(uint256 indexed willId, address indexed notary, bool verified);

    // ============================================
    // State Variables
    // ============================================

    uint256 public willCounter;
    mapping(uint256 => Will) public wills;
    mapping(uint256 => Beneficiary[]) internal _beneficiaries;
    mapping(uint256 => address[]) internal _notaries;
    mapping(address => uint256[]) public testatorWills;
    mapping(address => uint256[]) public beneficiaryWills;
    mapping(uint256 => mapping(address => bool)) public delegatedCheckIn;
    mapping(uint256 => mapping(address => bool)) public hasVerified;

    // Configuration
    uint256 public minInactivityPeriod = 30 days;
    uint256 public maxBeneficiaries = 20;
    uint256 public platformFeeBps = 100;     // 1%
    uint256 public executorRewardBps = 10;   // 0.1%
    address[] public commissionWallets;

    // ============================================
    // Constructor
    // ============================================

    constructor(address[] memory _commissionWallets) Ownable(msg.sender) {
        require(_commissionWallets.length > 0, "Need wallets");
        commissionWallets = _commissionWallets;
    }

    // ============================================
    // Will Management
    // ============================================

    function createWill(
        uint256 _inactivityThreshold,
        uint256 _gracePeriod
    ) external payable whenNotPaused returns (uint256) {
        require(_inactivityThreshold >= minInactivityPeriod, "Too short");
        require(_gracePeriod >= 1 days, "Grace too short");

        willCounter++;
        uint256 willId = willCounter;

        wills[willId] = Will({
            testator: msg.sender,
            status: WillStatus.Active,
            inactivityThreshold: _inactivityThreshold,
            lastActivityTime: block.timestamp,
            gracePeriod: _gracePeriod,
            triggeredAt: 0,
            totalValue: msg.value,
            requiredNotaries: 0,
            verificationCount: 0
        });

        testatorWills[msg.sender].push(willId);
        emit WillCreated(willId, msg.sender, _inactivityThreshold);
        return willId;
    }

    function cancelWill(uint256 _willId) external nonReentrant {
        Will storage will = wills[_willId];
        require(will.testator == msg.sender, "Not testator");
        require(will.status == WillStatus.Active, "Cannot cancel");

        will.status = WillStatus.Cancelled;

        if (will.totalValue > 0) {
            (bool sent, ) = payable(msg.sender).call{value: will.totalValue}("");
            require(sent, "Refund failed");
        }

        emit WillCancelled(_willId);
    }

    // ============================================
    // Beneficiaries
    // ============================================

    function addBeneficiary(
        uint256 _willId,
        address _beneficiary,
        uint256 _allocationBps,
        VestingType _vestingType,
        uint256 _vestingDuration
    ) external {
        Will storage will = wills[_willId];
        require(will.testator == msg.sender, "Not testator");
        require(will.status == WillStatus.Active, "Not active");
        require(_beneficiary != address(0), "Invalid addr");
        require(_beneficiaries[_willId].length < maxBeneficiaries, "Max reached");

        _beneficiaries[_willId].push(Beneficiary({
            addr: _beneficiary,
            allocationBps: _allocationBps,
            vestingType: _vestingType,
            vestingDuration: _vestingDuration,
            amountClaimed: 0
        }));

        beneficiaryWills[_beneficiary].push(_willId);
        _recordActivity(_willId);
        emit BeneficiaryAdded(_willId, _beneficiary, _allocationBps);
    }

    function removeBeneficiary(uint256 _willId, uint256 _index) external {
        Will storage will = wills[_willId];
        require(will.testator == msg.sender, "Not testator");
        require(will.status == WillStatus.Active, "Not active");

        Beneficiary[] storage bens = _beneficiaries[_willId];
        require(_index < bens.length, "Invalid index");

        address removed = bens[_index].addr;
        bens[_index] = bens[bens.length - 1];
        bens.pop();

        _recordActivity(_willId);
        emit BeneficiaryRemoved(_willId, removed);
    }

    function getBeneficiaries(uint256 _willId) external view returns (Beneficiary[] memory) {
        return _beneficiaries[_willId];
    }

    // ============================================
    // Deposits
    // ============================================

    function depositETH(uint256 _willId) external payable nonReentrant {
        Will storage will = wills[_willId];
        require(will.testator == msg.sender, "Not testator");
        require(will.status == WillStatus.Active, "Not active");

        will.totalValue += msg.value;
        _recordActivity(_willId);
        emit AssetDeposited(_willId, address(0), msg.value);
    }

    // ============================================
    // Check-In
    // ============================================

    function checkIn(uint256 _willId) external {
        Will storage will = wills[_willId];
        require(will.testator == msg.sender || delegatedCheckIn[_willId][msg.sender], "Not authorized");

        if (will.status == WillStatus.InGracePeriod) {
            will.status = WillStatus.Active;
            will.triggeredAt = 0;
            emit TriggerCancelled(_willId);
        }

        _recordActivity(_willId);
        emit CheckIn(_willId, msg.sender);
    }

    function setDelegate(uint256 _willId, address _delegate, bool _allowed) external {
        require(wills[_willId].testator == msg.sender, "Not testator");
        delegatedCheckIn[_willId][_delegate] = _allowed;
    }

    function _recordActivity(uint256 _willId) internal {
        wills[_willId].lastActivityTime = block.timestamp;
        emit ActivityRecorded(_willId, block.timestamp);
    }

    // ============================================
    // Trigger & Execute
    // ============================================

    function triggerWill(uint256 _willId) external {
        Will storage will = wills[_willId];
        require(will.status == WillStatus.Active, "Not active");
        require(block.timestamp >= will.lastActivityTime + will.inactivityThreshold, "Not inactive");

        will.status = WillStatus.InGracePeriod;
        will.triggeredAt = block.timestamp;

        emit WillTriggered(_willId, block.timestamp + will.gracePeriod);
    }

    function executeWill(uint256 _willId) external nonReentrant {
        Will storage will = wills[_willId];
        require(will.status == WillStatus.InGracePeriod, "Not triggered");
        require(block.timestamp >= will.triggeredAt + will.gracePeriod, "Grace active");

        if (will.requiredNotaries > 0) {
            require(will.verificationCount >= will.requiredNotaries, "Need verifications");
        }

        will.status = WillStatus.Executed;

        uint256 platformFee = (will.totalValue * platformFeeBps) / 10000;
        uint256 executorReward = (will.totalValue * executorRewardBps) / 10000;
        uint256 distributable = will.totalValue - platformFee - executorReward;

        // Pay executor
        if (executorReward > 0) {
            payable(msg.sender).transfer(executorReward);
        }

        // Platform fee
        if (platformFee > 0 && commissionWallets.length > 0) {
            uint256 share = platformFee / commissionWallets.length;
            for (uint256 i = 0; i < commissionWallets.length; i++) {
                payable(commissionWallets[i]).transfer(share);
            }
        }

        // Distribute to beneficiaries
        Beneficiary[] storage bens = _beneficiaries[_willId];
        for (uint256 i = 0; i < bens.length; i++) {
            uint256 amount = (distributable * bens[i].allocationBps) / 10000;
            if (amount > 0 && bens[i].vestingType == VestingType.Immediate) {
                (bool sent, ) = payable(bens[i].addr).call{value: amount}("");
                if (sent) {
                    bens[i].amountClaimed = amount;
                    emit AssetDistributed(_willId, bens[i].addr, amount);
                }
            }
        }

        emit WillExecuted(_willId, distributable);
    }

    // ============================================
    // Notary
    // ============================================

    function assignNotary(uint256 _willId, address _notary) external {
        require(wills[_willId].testator == msg.sender, "Not testator");
        _notaries[_willId].push(_notary);
        wills[_willId].requiredNotaries++;
    }

    function submitVerification(uint256 _willId, bool _verified) external {
        require(!hasVerified[_willId][msg.sender], "Already verified");

        bool isNotary = false;
        for (uint256 i = 0; i < _notaries[_willId].length; i++) {
            if (_notaries[_willId][i] == msg.sender) {
                isNotary = true;
                break;
            }
        }
        require(isNotary, "Not notary");

        hasVerified[_willId][msg.sender] = true;
        if (_verified) {
            wills[_willId].verificationCount++;
        }

        emit NotaryVerification(_willId, msg.sender, _verified);
    }

    // ============================================
    // View Functions
    // ============================================

    function canTriggerWill(uint256 _willId) external view returns (bool) {
        Will storage will = wills[_willId];
        return will.status == WillStatus.Active &&
               block.timestamp >= will.lastActivityTime + will.inactivityThreshold;
    }

    function canExecuteWill(uint256 _willId) external view returns (bool) {
        Will storage will = wills[_willId];
        return will.status == WillStatus.InGracePeriod &&
               block.timestamp >= will.triggeredAt + will.gracePeriod &&
               (will.requiredNotaries == 0 || will.verificationCount >= will.requiredNotaries);
    }

    function getWillStatus(uint256 _willId) external view returns (WillStatus) {
        return wills[_willId].status;
    }

    function getWillTotalValue(uint256 _willId) external view returns (uint256) {
        return wills[_willId].totalValue;
    }

    function getTestatorWills(address _testator) external view returns (uint256[] memory) {
        return testatorWills[_testator];
    }

    // ============================================
    // Admin
    // ============================================

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setMinInactivityPeriod(uint256 _period) external onlyOwner {
        minInactivityPeriod = _period;
    }

    function setFees(uint256 _platformBps, uint256 _executorBps) external onlyOwner {
        require(_platformBps <= 500, "Too high");
        platformFeeBps = _platformBps;
        executorRewardBps = _executorBps;
    }

    receive() external payable {}
}
