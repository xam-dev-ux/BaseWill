// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./interfaces/IBaseWill.sol";
import "./interfaces/INotaryRegistry.sol";
import "./libraries/WillLib.sol";
import "./libraries/VestingLib.sol";
import "./libraries/AssetLib.sol";

/**
 * @title BaseWill
 * @author BaseWill Team
 * @notice Decentralized inheritance platform for automatic crypto asset distribution
 * @dev Main contract handling will creation, management, and execution
 *
 * ============================================================================
 * LEGAL DISCLAIMER
 * ============================================================================
 * BaseWill is a technical tool providing blockchain-based infrastructure for
 * asset distribution. It does NOT constitute legal advice and is NOT a
 * substitute for proper estate planning with qualified legal professionals.
 *
 * Key considerations:
 * - Enforceability of onchain wills varies by jurisdiction
 * - Users should consult estate planning attorneys
 * - This platform provides technical infrastructure only
 * - No guarantees are made about legal validity in any jurisdiction
 * - Users are responsible for compliance with local laws
 * - Tax obligations vary by region and must be handled separately
 *
 * By using this platform, you acknowledge these limitations and accept full
 * responsibility for understanding the legal implications in your jurisdiction.
 * ============================================================================
 */
contract BaseWill is
    IBaseWill,
    Ownable2Step,
    ReentrancyGuard,
    Pausable,
    IERC721Receiver,
    IERC1155Receiver
{
    using WillLib for IBaseWill.Will;
    using VestingLib for IBaseWill.VestingSchedule;

    // ============ Configuration State ============

    /// @notice Minimum inactivity period allowed (90 days)
    uint256 public minInactivityPeriod;

    /// @notice Maximum beneficiaries per will
    uint256 public maxBeneficiaries;

    /// @notice Minimum notaries required for verification
    uint256 public minNotaries;

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps;

    /// @notice Notary reward in basis points (50 = 0.5%)
    uint256 public notaryRewardBps;

    /// @notice Executor reward in basis points (10 = 0.1%)
    uint256 public executorRewardBps;

    /// @notice Emergency withdrawal cooldown period
    uint256 public emergencyWithdrawalCooldown;

    /// @notice Default grace period for new wills
    uint256 public defaultGracePeriod;

    /// @notice Default dispute period for new wills
    uint256 public defaultDisputePeriod;

    /// @notice Dispute bond amount required
    uint256 public disputeBondAmount;

    /// @notice Commission wallet addresses
    address[] public commissionWallets;

    /// @notice Maximum commission wallets allowed
    uint256 public constant MAX_COMMISSION_WALLETS = 10;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ Will Storage ============

    /// @notice Counter for will IDs
    uint256 public willCounter;

    /// @notice Mapping of will ID to Will struct
    mapping(uint256 => Will) private wills;

    /// @notice Mapping of will ID to beneficiaries
    mapping(uint256 => Beneficiary[]) private willBeneficiaries;

    /// @notice Mapping of will ID to assets
    mapping(uint256 => Asset[]) private willAssets;

    /// @notice Mapping of will ID to notary verifications
    mapping(uint256 => NotaryVerification[]) private willVerifications;

    /// @notice Mapping of will ID to assigned notaries
    mapping(uint256 => address[]) private willNotaries;

    /// @notice Mapping of will ID to required verifications (M of N)
    mapping(uint256 => uint256) private requiredVerifications;

    /// @notice Mapping of will ID to disputes
    mapping(uint256 => Dispute[]) private willDisputes;

    /// @notice Mapping of will ID to guardians
    mapping(uint256 => Guardian[]) private willGuardians;

    /// @notice Mapping of will ID to delegated check-in addresses
    mapping(uint256 => mapping(address => bool)) private delegatedCheckIns;

    /// @notice Mapping of testator to their will IDs
    mapping(address => uint256[]) private testatorWillIds;

    /// @notice Mapping of beneficiary to will IDs they're included in
    mapping(address => uint256[]) private beneficiaryWillIds;

    /// @notice Mapping of will ID to ETH balance held
    mapping(uint256 => uint256) private willETHBalance;

    /// @notice Mapping of will ID to emergency withdrawal request time
    mapping(uint256 => uint256) private emergencyWithdrawalRequests;

    /// @notice Mapping of will ID to guardian recovery address
    mapping(uint256 => address) private guardianRecoveryAddresses;

    /// @notice Mapping of will ID to guardian recovery vote count
    mapping(uint256 => uint256) private guardianRecoveryVotes;

    // ============ External Contracts ============

    /// @notice Notary registry contract
    INotaryRegistry public notaryRegistry;

    // ============ Platform Statistics ============

    /// @notice Total value secured across all wills
    uint256 public totalValueSecured;

    /// @notice Total value distributed to beneficiaries
    uint256 public totalDistributed;

    /// @notice Number of executed wills
    uint256 public executedWillsCount;

    // ============ Constructor ============

    /**
     * @notice Initialize BaseWill contract
     * @param _notaryRegistry Address of NotaryRegistry contract
     * @param _commissionWallets Initial commission wallet addresses
     * @param _platformFeeBps Platform fee in basis points
     * @param _notaryRewardBps Notary reward in basis points
     * @param _executorRewardBps Executor reward in basis points
     */
    constructor(
        address _notaryRegistry,
        address[] memory _commissionWallets,
        uint256 _platformFeeBps,
        uint256 _notaryRewardBps,
        uint256 _executorRewardBps
    ) Ownable(msg.sender) {
        require(_notaryRegistry != address(0), "Invalid notary registry");
        require(_commissionWallets.length > 0, "Need at least one commission wallet");
        require(_commissionWallets.length <= MAX_COMMISSION_WALLETS, "Too many commission wallets");
        require(_platformFeeBps + _notaryRewardBps + _executorRewardBps <= 500, "Total fees exceed 5%");

        notaryRegistry = INotaryRegistry(_notaryRegistry);
        commissionWallets = _commissionWallets;
        platformFeeBps = _platformFeeBps;
        notaryRewardBps = _notaryRewardBps;
        executorRewardBps = _executorRewardBps;

        // Set defaults
        minInactivityPeriod = 90 days;
        maxBeneficiaries = 20;
        minNotaries = 2;
        emergencyWithdrawalCooldown = 30 days;
        defaultGracePeriod = 30 days;
        defaultDisputePeriod = 90 days;
        disputeBondAmount = 0.1 ether;
    }

    // ============ Will Creation & Management ============

    /**
     * @inheritdoc IBaseWill
     */
    function createWill(
        ActivationMode activationMode,
        uint256 inactivityThreshold,
        uint256 gracePeriod,
        uint256 disputePeriod,
        bytes32 metadataHash,
        address backupExecutor
    ) external whenNotPaused returns (uint256 willId) {
        // Validate parameters
        (bool valid, string memory reason) = WillLib.validateWillParams(
            inactivityThreshold,
            gracePeriod,
            disputePeriod,
            msg.sender
        );
        require(valid, reason);

        // Increment counter
        willCounter++;
        willId = willCounter;

        // Create will
        wills[willId] = Will({
            id: willId,
            testator: msg.sender,
            status: WillStatus.DRAFT,
            activationMode: activationMode,
            privacyMode: PrivacyMode.PUBLIC,
            inactivityThreshold: inactivityThreshold,
            gracePeriod: gracePeriod,
            disputePeriod: disputePeriod,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            lastActivity: block.timestamp,
            triggerTime: 0,
            executionTime: 0,
            metadataHash: metadataHash,
            encryptedDataHash: bytes32(0),
            backupExecutor: backupExecutor,
            version: 1
        });

        // Track testator's wills
        testatorWillIds[msg.sender].push(willId);

        emit WillCreated(
            willId,
            msg.sender,
            activationMode,
            inactivityThreshold,
            0 // No beneficiaries yet
        );

        return willId;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function updateWillMetadata(uint256 willId, bytes32 newMetadataHash) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        bytes32 oldHash = will.metadataHash;
        will.metadataHash = newMetadataHash;
        will.updatedAt = block.timestamp;
        will.version++;

        _recordActivity(willId, ActivityType.WILL_UPDATE);

        emit WillUpdated(willId, "metadataHash", oldHash, newMetadataHash, will.version);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function cancelWill(uint256 willId, string calldata reason) external nonReentrant {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(
            will.status == WillStatus.DRAFT ||
            will.status == WillStatus.ACTIVE ||
            will.status == WillStatus.TRIGGERED,
            "Cannot cancel in current status"
        );

        will.status = WillStatus.CANCELLED;
        will.updatedAt = block.timestamp;

        // Return deposited ETH to testator
        uint256 ethBalance = willETHBalance[willId];
        if (ethBalance > 0) {
            willETHBalance[willId] = 0;
            totalValueSecured -= ethBalance;

            (bool success, ) = payable(msg.sender).call{value: ethBalance}("");
            require(success, "ETH transfer failed");
        }

        emit WillCancelled(willId, msg.sender, reason);
    }

    /**
     * @notice Activate a draft will
     * @param willId Will identifier
     */
    function activateWill(uint256 willId) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(will.status == WillStatus.DRAFT, "Will not in DRAFT status");

        // Validate beneficiaries total 100%
        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];
        require(beneficiaries.length > 0, "No beneficiaries");

        (bool validAllocation, uint256 totalBps) = WillLib.validateTotalAllocation(beneficiaries);
        require(validAllocation, "Allocations must total 100%");

        // Check notary requirements
        if (WillLib.requiresNotaries(will.activationMode)) {
            require(willNotaries[willId].length >= minNotaries, "Insufficient notaries assigned");
        }

        will.status = WillStatus.ACTIVE;
        will.lastActivity = block.timestamp;
        will.updatedAt = block.timestamp;

        emit WillUpdated(willId, "status", bytes32(uint256(WillStatus.DRAFT)), bytes32(uint256(WillStatus.ACTIVE)), will.version);
    }

    // ============ Beneficiary Management ============

    /**
     * @inheritdoc IBaseWill
     */
    function addBeneficiary(
        uint256 willId,
        address beneficiary,
        uint256 allocationBps,
        VestingSchedule calldata vestingSchedule,
        bool isPrimary,
        bytes32 labelHash
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        require(beneficiary != address(0), "Invalid beneficiary address");
        require(beneficiary != msg.sender, "Cannot be own beneficiary");
        require(allocationBps > 0 && allocationBps <= BPS_DENOMINATOR, "Invalid allocation");

        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];
        require(beneficiaries.length < maxBeneficiaries, "Max beneficiaries reached");

        // Check not already added
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            require(beneficiaries[i].beneficiaryAddress != beneficiary, "Beneficiary already exists");
        }

        // Validate vesting schedule
        (bool validSchedule, string memory scheduleReason) = VestingLib.validateSchedule(vestingSchedule);
        require(validSchedule, scheduleReason);

        beneficiaries.push(Beneficiary({
            beneficiaryAddress: beneficiary,
            allocationBps: allocationBps,
            vestingSchedule: vestingSchedule,
            isPrimary: isPrimary,
            hasAccepted: false,
            labelHash: labelHash,
            amountClaimed: 0,
            lastClaimTime: 0
        }));

        // Track beneficiary's wills
        beneficiaryWillIds[beneficiary].push(willId);

        will.updatedAt = block.timestamp;
        will.version++;

        _recordActivity(willId, ActivityType.WILL_UPDATE);

        emit BeneficiaryAdded(willId, beneficiary, allocationBps);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function removeBeneficiary(uint256 willId, address beneficiary) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        uint256 indexToRemove = type(uint256).max;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == beneficiary) {
                indexToRemove = i;
                break;
            }
        }

        require(indexToRemove != type(uint256).max, "Beneficiary not found");

        // Remove by swapping with last element
        beneficiaries[indexToRemove] = beneficiaries[beneficiaries.length - 1];
        beneficiaries.pop();

        will.updatedAt = block.timestamp;
        will.version++;

        _recordActivity(willId, ActivityType.WILL_UPDATE);

        emit BeneficiaryRemoved(willId, beneficiary);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function updateBeneficiaryAllocation(
        uint256 willId,
        address beneficiary,
        uint256 newAllocationBps
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        require(newAllocationBps > 0 && newAllocationBps <= BPS_DENOMINATOR, "Invalid allocation");

        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        bool found = false;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == beneficiary) {
                uint256 oldAllocation = beneficiaries[i].allocationBps;
                beneficiaries[i].allocationBps = newAllocationBps;
                found = true;

                emit WillUpdated(
                    willId,
                    "beneficiaryAllocation",
                    bytes32(oldAllocation),
                    bytes32(newAllocationBps),
                    will.version
                );
                break;
            }
        }

        require(found, "Beneficiary not found");

        will.updatedAt = block.timestamp;
        will.version++;

        _recordActivity(willId, ActivityType.WILL_UPDATE);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function acceptBeneficiaryDesignation(uint256 willId) external {
        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        bool found = false;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == msg.sender) {
                beneficiaries[i].hasAccepted = true;
                found = true;
                break;
            }
        }

        require(found, "Not a beneficiary of this will");

        emit BeneficiaryResponse(willId, msg.sender, true);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function rejectBeneficiaryDesignation(uint256 willId) external {
        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        uint256 indexToRemove = type(uint256).max;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == msg.sender) {
                indexToRemove = i;
                break;
            }
        }

        require(indexToRemove != type(uint256).max, "Not a beneficiary of this will");

        // Remove beneficiary
        beneficiaries[indexToRemove] = beneficiaries[beneficiaries.length - 1];
        beneficiaries.pop();

        emit BeneficiaryResponse(willId, msg.sender, false);
    }

    // ============ Asset Management ============

    /**
     * @inheritdoc IBaseWill
     */
    function addAsset(
        uint256 willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId,
        uint256 amount
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        Asset[] storage assets = willAssets[willId];

        assets.push(Asset({
            assetType: assetType,
            contractAddress: contractAddress,
            tokenId: tokenId,
            amount: amount,
            isIncluded: true
        }));

        will.updatedAt = block.timestamp;

        _recordActivity(willId, ActivityType.WILL_UPDATE);

        emit AssetAdded(willId, assetType, contractAddress, tokenId, amount);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function removeAsset(
        uint256 willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        Asset[] storage assets = willAssets[willId];

        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].assetType == assetType &&
                assets[i].contractAddress == contractAddress &&
                assets[i].tokenId == tokenId) {
                assets[i].isIncluded = false;

                emit AssetRemoved(willId, assetType, contractAddress, tokenId);
                break;
            }
        }

        will.updatedAt = block.timestamp;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function depositETH(uint256 willId) external payable nonReentrant {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(msg.value > 0, "Must deposit > 0");

        willETHBalance[willId] += msg.value;
        totalValueSecured += msg.value;

        _recordActivity(willId, ActivityType.ASSET_DEPOSIT);

        emit AssetAdded(willId, AssetType.ETH, address(0), 0, msg.value);
    }

    // ============ Activity & Check-in ============

    /**
     * @inheritdoc IBaseWill
     */
    function checkIn(uint256 willId) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(will.status == WillStatus.ACTIVE || will.status == WillStatus.TRIGGERED, "Will not active/triggered");

        // If triggered, cancel the trigger (testator is alive)
        if (will.status == WillStatus.TRIGGERED) {
            will.status = WillStatus.ACTIVE;
            will.triggerTime = 0;
            emit GracePeriodCancelled(willId, msg.sender);
        }

        _recordActivity(willId, ActivityType.MANUAL_CHECK_IN);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function delegatedCheckIn(uint256 willId) external {
        require(delegatedCheckIns[willId][msg.sender], "Not authorized for delegated check-in");

        Will storage will = wills[willId];
        require(will.status == WillStatus.ACTIVE || will.status == WillStatus.TRIGGERED, "Will not active/triggered");

        if (will.status == WillStatus.TRIGGERED) {
            will.status = WillStatus.ACTIVE;
            will.triggerTime = 0;
            emit GracePeriodCancelled(willId, will.testator);
        }

        _recordActivity(willId, ActivityType.DELEGATED_CHECK_IN);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function addDelegatedCheckIn(uint256 willId, address delegate) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(delegate != address(0), "Invalid delegate");

        delegatedCheckIns[willId][delegate] = true;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function removeDelegatedCheckIn(uint256 willId, address delegate) external {
        Will storage will = wills[willId];
        _requireTestator(will);

        delegatedCheckIns[willId][delegate] = false;
    }

    // ============ Notary Functions ============

    /**
     * @inheritdoc IBaseWill
     */
    function assignNotaries(
        uint256 willId,
        address[] calldata notaryAddresses,
        uint256 _requiredVerifications
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        require(notaryAddresses.length >= minNotaries, "Need at least minNotaries");
        require(_requiredVerifications >= 1 && _requiredVerifications <= notaryAddresses.length, "Invalid required verifications");

        // Verify all are active notaries
        for (uint256 i = 0; i < notaryAddresses.length; i++) {
            require(notaryRegistry.isActiveNotary(notaryAddresses[i]), "Address is not an active notary");
        }

        willNotaries[willId] = notaryAddresses;
        requiredVerifications[willId] = _requiredVerifications;

        will.updatedAt = block.timestamp;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function submitVerification(uint256 willId, bytes32 proofHash) external {
        Will storage will = wills[willId];
        require(
            will.status == WillStatus.ACTIVE || will.status == WillStatus.TRIGGERED,
            "Will not active/triggered"
        );
        require(WillLib.requiresNotaries(will.activationMode), "Will doesn't require notary verification");

        // Check caller is assigned notary
        address[] storage notaries = willNotaries[willId];
        bool isAssigned = false;
        for (uint256 i = 0; i < notaries.length; i++) {
            if (notaries[i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        require(isAssigned, "Not an assigned notary");

        // Check not already verified
        NotaryVerification[] storage verifications = willVerifications[willId];
        for (uint256 i = 0; i < verifications.length; i++) {
            require(verifications[i].notaryAddress != msg.sender, "Already verified");
        }

        verifications.push(NotaryVerification({
            notaryAddress: msg.sender,
            verificationTime: block.timestamp,
            proofHash: proofHash,
            isValid: true
        }));

        // Record in notary registry
        notaryRegistry.recordVerification(msg.sender, willId, proofHash);

        uint256 verificationCount = verifications.length;

        emit NotaryVerificationSubmitted(willId, msg.sender, proofHash, verificationCount);

        // Check if threshold met
        if (verificationCount >= requiredVerifications[willId]) {
            // If time-based not required (pure notary mode), trigger directly
            if (will.activationMode == ActivationMode.NOTARY_VERIFIED) {
                _triggerWill(willId, "Notary verification threshold met");
            }
        }
    }

    // ============ Trigger & Execution ============

    /**
     * @inheritdoc IBaseWill
     */
    function triggerWill(uint256 willId) external {
        Will storage will = wills[willId];
        require(will.status == WillStatus.ACTIVE, "Will not active");

        bool canTrigger = false;
        string memory reason;

        if (will.activationMode == ActivationMode.TIME_BASED) {
            // Check inactivity threshold
            uint256 inactiveTime = block.timestamp - will.lastActivity;
            canTrigger = inactiveTime >= will.inactivityThreshold;
            reason = "Inactivity threshold reached";
        } else if (will.activationMode == ActivationMode.NOTARY_VERIFIED) {
            // Check notary verifications
            canTrigger = willVerifications[willId].length >= requiredVerifications[willId];
            reason = "Notary verification threshold met";
        } else {
            // HYBRID: Both conditions required
            uint256 inactiveTime = block.timestamp - will.lastActivity;
            bool timeCondition = inactiveTime >= will.inactivityThreshold;
            bool notaryCondition = willVerifications[willId].length >= requiredVerifications[willId];
            canTrigger = timeCondition && notaryCondition;
            reason = "Both inactivity and notary conditions met";
        }

        require(canTrigger, "Trigger conditions not met");

        _triggerWill(willId, reason);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function cancelTrigger(uint256 willId) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(will.status == WillStatus.TRIGGERED, "Will not triggered");

        // Check still in grace period
        uint256 gracePeriodEnd = will.triggerTime + will.gracePeriod;
        require(block.timestamp < gracePeriodEnd, "Grace period ended");

        will.status = WillStatus.ACTIVE;
        will.triggerTime = 0;
        will.lastActivity = block.timestamp;

        emit GracePeriodCancelled(willId, msg.sender);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function executeWill(uint256 willId) external nonReentrant {
        Will storage will = wills[willId];
        require(will.status == WillStatus.TRIGGERED, "Will not triggered");

        // Check grace period ended
        uint256 gracePeriodEnd = will.triggerTime + will.gracePeriod;
        require(block.timestamp >= gracePeriodEnd, "Grace period not ended");

        // Check no pending disputes
        Dispute[] storage disputes = willDisputes[willId];
        for (uint256 i = 0; i < disputes.length; i++) {
            require(disputes[i].outcome != DisputeOutcome.PENDING, "Pending dispute exists");
        }

        will.status = WillStatus.EXECUTED;
        will.executionTime = block.timestamp;

        uint256 totalValue = willETHBalance[willId];

        emit WillExecutionStarted(willId, totalValue, msg.sender);

        // Calculate fees
        (
            uint256 platformFee,
            uint256 notaryReward,
            uint256 executorReward,
            uint256 distributableAmount
        ) = WillLib.calculateDistributionAmounts(
            totalValue,
            platformFeeBps,
            notaryRewardBps,
            executorRewardBps
        );

        // Distribute to beneficiaries
        _distributeAssets(willId, distributableAmount);

        // Pay platform fee
        if (platformFee > 0) {
            _distributePlatformFee(willId, platformFee);
        }

        // Pay notary rewards
        if (notaryReward > 0 && willVerifications[willId].length > 0) {
            _distributeNotaryRewards(willId, notaryReward);
        }

        // Pay executor reward
        if (executorReward > 0) {
            (bool success, ) = payable(msg.sender).call{value: executorReward}("");
            if (success) {
                emit ExecutorRewardPaid(willId, msg.sender, executorReward);
            }
        }

        // Update statistics
        executedWillsCount++;
        totalDistributed += distributableAmount;
        totalValueSecured -= totalValue;
        willETHBalance[willId] = 0;

        // Mark notary verifications as successful
        NotaryVerification[] storage verifications = willVerifications[willId];
        for (uint256 i = 0; i < verifications.length; i++) {
            if (verifications[i].isValid) {
                notaryRegistry.markVerificationSuccessful(verifications[i].notaryAddress, willId);
            }
        }
    }

    /**
     * @inheritdoc IBaseWill
     */
    function claimVestedAssets(uint256 willId) external nonReentrant {
        Will storage will = wills[willId];
        require(will.status == WillStatus.EXECUTED, "Will not executed");

        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == msg.sender) {
                VestingSchedule memory schedule = beneficiaries[i].vestingSchedule;

                // For immediate vesting, should have been distributed during execution
                require(schedule.vestingType != VestingType.IMMEDIATE, "No vesting - already distributed");

                // Calculate claimable amount
                // Note: In a full implementation, we'd track vested amounts separately
                // This is a simplified version

                uint256 releaseNumber = VestingLib.getCurrentReleaseNumber(
                    schedule,
                    will.executionTime,
                    block.timestamp
                );

                require(releaseNumber > 0, "No vested amount available");

                emit VestingReleased(willId, msg.sender, 0, releaseNumber);
                return;
            }
        }

        revert("Not a beneficiary");
    }

    // ============ Emergency Functions ============

    /**
     * @inheritdoc IBaseWill
     */
    function initiateEmergencyWithdrawal(uint256 willId) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(will.status == WillStatus.ACTIVE || will.status == WillStatus.TRIGGERED, "Invalid status");
        require(emergencyWithdrawalRequests[willId] == 0, "Already initiated");

        emergencyWithdrawalRequests[willId] = block.timestamp;

        uint256 cooldownEnd = block.timestamp + emergencyWithdrawalCooldown;

        emit EmergencyWithdrawalInitiated(willId, cooldownEnd);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function completeEmergencyWithdrawal(uint256 willId) external nonReentrant {
        Will storage will = wills[willId];
        _requireTestator(will);

        uint256 requestTime = emergencyWithdrawalRequests[willId];
        require(requestTime > 0, "No withdrawal requested");

        uint256 cooldownEnd = requestTime + emergencyWithdrawalCooldown;
        require(block.timestamp >= cooldownEnd, "Cooldown not complete");

        uint256 totalValue = willETHBalance[willId];

        will.status = WillStatus.CANCELLED;
        willETHBalance[willId] = 0;
        emergencyWithdrawalRequests[willId] = 0;
        totalValueSecured -= totalValue;

        if (totalValue > 0) {
            (bool success, ) = payable(msg.sender).call{value: totalValue}("");
            require(success, "Transfer failed");
        }

        emit EmergencyWithdrawalCompleted(willId, msg.sender, totalValue);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function cancelEmergencyWithdrawal(uint256 willId) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        require(emergencyWithdrawalRequests[willId] > 0, "No withdrawal to cancel");

        emergencyWithdrawalRequests[willId] = 0;
    }

    // ============ Dispute Functions ============

    /**
     * @inheritdoc IBaseWill
     */
    function fileDispute(uint256 willId, bytes32 reasonHash) external payable nonReentrant {
        Will storage will = wills[willId];
        require(
            will.status == WillStatus.TRIGGERED || will.status == WillStatus.EXECUTED,
            "Cannot dispute in current status"
        );

        // Check in dispute period
        uint256 disputeStart = will.triggerTime + will.gracePeriod;
        uint256 disputeEnd = disputeStart + will.disputePeriod;
        require(block.timestamp >= disputeStart && block.timestamp < disputeEnd, "Not in dispute period");

        // Require bond
        require(msg.value >= disputeBondAmount, "Insufficient dispute bond");

        willDisputes[willId].push(Dispute({
            disputer: msg.sender,
            disputeTime: block.timestamp,
            reasonHash: reasonHash,
            bondAmount: msg.value,
            outcome: DisputeOutcome.PENDING,
            resolvedTime: 0
        }));

        // Set status to disputed
        will.status = WillStatus.DISPUTED;

        emit DisputeFiled(willId, msg.sender, reasonHash, msg.value);
        emit DisputePeriodStarted(willId, disputeEnd);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function resolveDispute(
        uint256 willId,
        uint256 disputeIndex,
        DisputeOutcome outcome
    ) external onlyOwner nonReentrant {
        Will storage will = wills[willId];
        require(will.status == WillStatus.DISPUTED, "Will not disputed");

        Dispute[] storage disputes = willDisputes[willId];
        require(disputeIndex < disputes.length, "Invalid dispute index");

        Dispute storage dispute = disputes[disputeIndex];
        require(dispute.outcome == DisputeOutcome.PENDING, "Already resolved");

        dispute.outcome = outcome;
        dispute.resolvedTime = block.timestamp;

        address refundedParty;

        if (outcome == DisputeOutcome.UPHELD) {
            // Dispute valid - refund disputer, revoke will
            refundedParty = dispute.disputer;
            will.status = WillStatus.REVOKED;

            (bool success, ) = payable(dispute.disputer).call{value: dispute.bondAmount}("");
            require(success, "Refund failed");
        } else {
            // Dispute rejected - bond goes to testator/beneficiaries, continue execution
            refundedParty = will.testator;
            will.status = WillStatus.TRIGGERED; // Allow execution to continue

            (bool success, ) = payable(will.testator).call{value: dispute.bondAmount}("");
            if (!success) {
                // If testator can't receive, add to will value
                willETHBalance[willId] += dispute.bondAmount;
            }
        }

        emit DisputeResolved(willId, outcome, refundedParty);
    }

    // ============ Guardian Functions ============

    /**
     * @inheritdoc IBaseWill
     */
    function addGuardian(uint256 willId, address guardian) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);
        require(guardian != address(0), "Invalid guardian");
        require(guardian != msg.sender, "Cannot be own guardian");

        Guardian[] storage guardians = willGuardians[willId];

        // Check not already added
        for (uint256 i = 0; i < guardians.length; i++) {
            require(guardians[i].guardianAddress != guardian, "Already a guardian");
        }

        guardians.push(Guardian({
            guardianAddress: guardian,
            hasVotedForRecovery: false,
            addedTime: block.timestamp
        }));

        emit GuardianAdded(willId, guardian);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function removeGuardian(uint256 willId, address guardian) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        Guardian[] storage guardians = willGuardians[willId];

        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i].guardianAddress == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                return;
            }
        }

        revert("Guardian not found");
    }

    /**
     * @inheritdoc IBaseWill
     */
    function voteForGuardianRecovery(uint256 willId, address recoveryAddress) external {
        Guardian[] storage guardians = willGuardians[willId];

        bool isGuardian = false;
        uint256 guardianIndex;

        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i].guardianAddress == msg.sender) {
                isGuardian = true;
                guardianIndex = i;
                break;
            }
        }

        require(isGuardian, "Not a guardian");
        require(!guardians[guardianIndex].hasVotedForRecovery, "Already voted");

        // If this is the first vote, set recovery address
        if (guardianRecoveryVotes[willId] == 0) {
            guardianRecoveryAddresses[willId] = recoveryAddress;
        } else {
            // Subsequent votes must match
            require(guardianRecoveryAddresses[willId] == recoveryAddress, "Recovery address mismatch");
        }

        guardians[guardianIndex].hasVotedForRecovery = true;
        guardianRecoveryVotes[willId]++;

        uint256 totalVotes = guardianRecoveryVotes[willId];

        emit GuardianVotedForRecovery(willId, msg.sender, totalVotes);

        // Check if majority reached (>50%)
        if (totalVotes > guardians.length / 2) {
            _executeGuardianRecovery(willId, recoveryAddress);
        }
    }

    /**
     * @inheritdoc IBaseWill
     */
    function setPrivacyMode(
        uint256 willId,
        PrivacyMode mode,
        bytes32 encryptedDataHash
    ) external {
        Will storage will = wills[willId];
        _requireTestator(will);
        _requireModifiable(will);

        will.privacyMode = mode;
        will.encryptedDataHash = encryptedDataHash;
        will.updatedAt = block.timestamp;
    }

    // ============ View Functions ============

    /**
     * @inheritdoc IBaseWill
     */
    function getWill(uint256 willId) external view returns (Will memory will) {
        return wills[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getTestatorWills(address testator) external view returns (uint256[] memory willIds) {
        return testatorWillIds[testator];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getBeneficiaryWills(address beneficiary) external view returns (uint256[] memory willIds) {
        return beneficiaryWillIds[beneficiary];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getWillStatus(uint256 willId) external view returns (
        WillStatus status,
        uint256 lastActivity,
        uint256 daysUntilTrigger,
        bool isTriggered
    ) {
        Will storage will = wills[willId];

        status = will.status;
        lastActivity = will.lastActivity;
        isTriggered = will.status == WillStatus.TRIGGERED;
        daysUntilTrigger = WillLib.getDaysUntilTrigger(will, block.timestamp);

        return (status, lastActivity, daysUntilTrigger, isTriggered);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getBeneficiaries(uint256 willId) external view returns (Beneficiary[] memory beneficiaries) {
        return willBeneficiaries[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getWillValue(uint256 willId) external view returns (
        uint256 ethBalance,
        uint256[] memory tokenBalances,
        uint256 nftCount
    ) {
        ethBalance = willETHBalance[willId];

        Asset[] storage assets = willAssets[willId];
        uint256 tokenCount = 0;
        nftCount = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].isIncluded) {
                if (assets[i].assetType == AssetType.ERC20) {
                    tokenCount++;
                } else if (assets[i].assetType == AssetType.ERC721 || assets[i].assetType == AssetType.ERC1155) {
                    nftCount++;
                }
            }
        }

        tokenBalances = new uint256[](tokenCount);
        // Note: In production, we'd populate this with actual balances

        return (ethBalance, tokenBalances, nftCount);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getNotaryVerifications(uint256 willId) external view returns (NotaryVerification[] memory verifications) {
        return willVerifications[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function canExecuteWill(uint256 willId) external view returns (bool canExecute) {
        Will storage will = wills[willId];

        if (will.status != WillStatus.TRIGGERED) {
            return false;
        }

        uint256 gracePeriodEnd = will.triggerTime + will.gracePeriod;
        if (block.timestamp < gracePeriodEnd) {
            return false;
        }

        // Check no pending disputes
        Dispute[] storage disputes = willDisputes[willId];
        for (uint256 i = 0; i < disputes.length; i++) {
            if (disputes[i].outcome == DisputeOutcome.PENDING) {
                return false;
            }
        }

        return true;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function estimateDistribution(uint256 willId) external view returns (
        address[] memory beneficiaryAddresses,
        uint256[] memory amounts,
        uint256 platformFee,
        uint256 notaryRewards,
        uint256 executorReward
    ) {
        uint256 totalValue = willETHBalance[willId];

        (platformFee, notaryRewards, executorReward, ) = WillLib.calculateDistributionAmounts(
            totalValue,
            platformFeeBps,
            notaryRewardBps,
            executorRewardBps
        );

        uint256 distributable = totalValue - platformFee - notaryRewards - executorReward;

        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];
        beneficiaryAddresses = new address[](beneficiaries.length);
        amounts = new uint256[](beneficiaries.length);

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiaryAddresses[i] = beneficiaries[i].beneficiaryAddress;
            amounts[i] = WillLib.calculateShare(distributable, beneficiaries[i].allocationBps);
        }

        return (beneficiaryAddresses, amounts, platformFee, notaryRewards, executorReward);
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getTestatorStats(address testator) external view returns (TestatorStats memory stats) {
        uint256[] storage ids = testatorWillIds[testator];

        stats.totalWills = ids.length;
        stats.lastActivity = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            Will storage will = wills[ids[i]];

            stats.totalValue += willETHBalance[ids[i]];
            stats.totalBeneficiaries += willBeneficiaries[ids[i]].length;

            if (will.lastActivity > stats.lastActivity) {
                stats.lastActivity = will.lastActivity;
            }

            if (will.status == WillStatus.ACTIVE) {
                stats.activeWills++;
            }
        }

        return stats;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getPlatformStats() external view returns (PlatformStats memory stats) {
        return PlatformStats({
            totalValueSecured: totalValueSecured,
            totalWillsCreated: willCounter,
            activeWills: _countActiveWills(),
            executedWills: executedWillsCount,
            totalDistributed: totalDistributed,
            registeredNotaries: notaryRegistry.getNotaryCount()
        });
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getActiveWills(uint256 offset, uint256 limit) external view returns (Will[] memory activeWills) {
        // Note: This is a simplified implementation
        // In production, we'd maintain a separate array of active will IDs
        uint256 count = 0;
        uint256 total = willCounter;

        // First pass: count active wills
        for (uint256 i = 1; i <= total; i++) {
            if (wills[i].status == WillStatus.ACTIVE) {
                count++;
            }
        }

        if (offset >= count) {
            return new Will[](0);
        }

        uint256 resultCount = limit;
        if (offset + limit > count) {
            resultCount = count - offset;
        }

        activeWills = new Will[](resultCount);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= total && added < resultCount; i++) {
            if (wills[i].status == WillStatus.ACTIVE) {
                if (found >= offset) {
                    activeWills[added] = wills[i];
                    added++;
                }
                found++;
            }
        }

        return activeWills;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getTriggeredWills(uint256 offset, uint256 limit) external view returns (uint256[] memory triggeredIds) {
        uint256 count = 0;
        uint256 total = willCounter;

        for (uint256 i = 1; i <= total; i++) {
            if (wills[i].status == WillStatus.TRIGGERED) {
                count++;
            }
        }

        if (offset >= count) {
            return new uint256[](0);
        }

        uint256 resultCount = limit;
        if (offset + limit > count) {
            resultCount = count - offset;
        }

        triggeredIds = new uint256[](resultCount);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= total && added < resultCount; i++) {
            if (wills[i].status == WillStatus.TRIGGERED) {
                if (found >= offset) {
                    triggeredIds[added] = i;
                    added++;
                }
                found++;
            }
        }

        return triggeredIds;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getDisputedWills() external view returns (uint256[] memory disputedIds) {
        uint256 count = 0;
        uint256 total = willCounter;

        for (uint256 i = 1; i <= total; i++) {
            if (wills[i].status == WillStatus.DISPUTED) {
                count++;
            }
        }

        disputedIds = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (wills[i].status == WillStatus.DISPUTED) {
                disputedIds[index] = i;
                index++;
            }
        }

        return disputedIds;
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getWillAssets(uint256 willId) external view returns (Asset[] memory assets) {
        return willAssets[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getGuardians(uint256 willId) external view returns (Guardian[] memory guardians) {
        return willGuardians[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getDisputes(uint256 willId) external view returns (Dispute[] memory disputes) {
        return willDisputes[willId];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function isDelegatedCheckIn(uint256 willId, address delegate) external view returns (bool isDelegated) {
        return delegatedCheckIns[willId][delegate];
    }

    /**
     * @inheritdoc IBaseWill
     */
    function getVestingStatus(uint256 willId, address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 vestedAmount,
        uint256 claimedAmount,
        uint256 nextReleaseTime
    ) {
        Will storage will = wills[willId];
        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == beneficiary) {
                uint256 willValue = willETHBalance[willId];
                totalAmount = WillLib.calculateShare(willValue, beneficiaries[i].allocationBps);
                claimedAmount = beneficiaries[i].amountClaimed;

                if (will.status == WillStatus.EXECUTED) {
                    vestedAmount = VestingLib.calculateVestedAmount(
                        beneficiaries[i].vestingSchedule,
                        totalAmount,
                        will.executionTime,
                        block.timestamp
                    );

                    nextReleaseTime = VestingLib.getNextReleaseTime(
                        beneficiaries[i].vestingSchedule,
                        will.executionTime,
                        block.timestamp,
                        claimedAmount,
                        totalAmount
                    );
                }

                return (totalAmount, vestedAmount, claimedAmount, nextReleaseTime);
            }
        }

        return (0, 0, 0, 0);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update configuration parameters
     * @param _maxBeneficiaries New max beneficiaries
     * @param _minNotaries New min notaries
     * @param _emergencyWithdrawalCooldown New cooldown period
     */
    function updateConfiguration(
        uint256 _maxBeneficiaries,
        uint256 _minNotaries,
        uint256 _emergencyWithdrawalCooldown
    ) external onlyOwner {
        if (_maxBeneficiaries > 0) {
            emit ConfigurationUpdated("maxBeneficiaries", maxBeneficiaries, _maxBeneficiaries);
            maxBeneficiaries = _maxBeneficiaries;
        }
        if (_minNotaries > 0) {
            emit ConfigurationUpdated("minNotaries", minNotaries, _minNotaries);
            minNotaries = _minNotaries;
        }
        if (_emergencyWithdrawalCooldown > 0) {
            emit ConfigurationUpdated("emergencyWithdrawalCooldown", emergencyWithdrawalCooldown, _emergencyWithdrawalCooldown);
            emergencyWithdrawalCooldown = _emergencyWithdrawalCooldown;
        }
    }

    /**
     * @notice Update fee parameters
     * @param _platformFeeBps New platform fee
     * @param _notaryRewardBps New notary reward
     * @param _executorRewardBps New executor reward
     */
    function updateFees(
        uint256 _platformFeeBps,
        uint256 _notaryRewardBps,
        uint256 _executorRewardBps
    ) external onlyOwner {
        require(_platformFeeBps + _notaryRewardBps + _executorRewardBps <= 500, "Total fees exceed 5%");

        platformFeeBps = _platformFeeBps;
        notaryRewardBps = _notaryRewardBps;
        executorRewardBps = _executorRewardBps;
    }

    /**
     * @notice Update commission wallets
     * @param newWallets New commission wallet addresses
     */
    function updateCommissionWallets(address[] calldata newWallets) external onlyOwner {
        require(newWallets.length > 0, "Need at least one wallet");
        require(newWallets.length <= MAX_COMMISSION_WALLETS, "Too many wallets");

        commissionWallets = newWallets;
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

    // ============ Internal Functions ============

    /**
     * @notice Require caller is testator of the will
     */
    function _requireTestator(Will storage will) internal view {
        require(will.testator == msg.sender, "Not testator");
    }

    /**
     * @notice Require will can be modified
     */
    function _requireModifiable(Will storage will) internal view {
        require(WillLib.canModifyWill(will.status), "Will cannot be modified");
    }

    /**
     * @notice Record activity and update last activity timestamp
     */
    function _recordActivity(uint256 willId, ActivityType activityType) internal {
        Will storage will = wills[willId];
        will.lastActivity = block.timestamp;

        emit ActivityRecorded(willId, activityType, block.timestamp);
    }

    /**
     * @notice Trigger a will
     */
    function _triggerWill(uint256 willId, string memory reason) internal {
        Will storage will = wills[willId];

        will.status = WillStatus.TRIGGERED;
        will.triggerTime = block.timestamp;

        uint256 gracePeriodEnd = block.timestamp + will.gracePeriod;

        emit WillTriggered(willId, reason, block.timestamp, gracePeriodEnd);
        emit GracePeriodStarted(willId, gracePeriodEnd);
    }

    /**
     * @notice Distribute assets to beneficiaries
     */
    function _distributeAssets(uint256 willId, uint256 distributableAmount) internal {
        Beneficiary[] storage beneficiaries = willBeneficiaries[willId];

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (!beneficiaries[i].isPrimary) continue;

            uint256 share = WillLib.calculateShare(distributableAmount, beneficiaries[i].allocationBps);

            if (share == 0) continue;

            // For immediate vesting, transfer now
            if (beneficiaries[i].vestingSchedule.vestingType == VestingType.IMMEDIATE) {
                (bool success, ) = payable(beneficiaries[i].beneficiaryAddress).call{value: share}("");

                if (success) {
                    beneficiaries[i].amountClaimed = share;
                    emit AssetDistributed(
                        willId,
                        beneficiaries[i].beneficiaryAddress,
                        AssetType.ETH,
                        share,
                        VestingType.IMMEDIATE
                    );
                }
            } else {
                // For other vesting types, record allocation (will be claimed later)
                emit AssetDistributed(
                    willId,
                    beneficiaries[i].beneficiaryAddress,
                    AssetType.ETH,
                    share,
                    beneficiaries[i].vestingSchedule.vestingType
                );
            }
        }
    }

    /**
     * @notice Distribute platform fee to commission wallets
     */
    function _distributePlatformFee(uint256 willId, uint256 totalFee) internal {
        uint256 walletCount = commissionWallets.length;
        uint256 sharePerWallet = totalFee / walletCount;

        address[] memory wallets = new address[](walletCount);
        uint256[] memory amounts = new uint256[](walletCount);

        for (uint256 i = 0; i < walletCount; i++) {
            wallets[i] = commissionWallets[i];
            amounts[i] = sharePerWallet;

            (bool success, ) = payable(commissionWallets[i]).call{value: sharePerWallet}("");
            // Don't revert if one wallet fails
        }

        emit FeeDistributed(willId, totalFee, wallets, amounts);
    }

    /**
     * @notice Distribute rewards to verifying notaries
     */
    function _distributeNotaryRewards(uint256 willId, uint256 totalReward) internal {
        NotaryVerification[] storage verifications = willVerifications[willId];
        uint256 validCount = 0;

        for (uint256 i = 0; i < verifications.length; i++) {
            if (verifications[i].isValid) {
                validCount++;
            }
        }

        if (validCount == 0) return;

        uint256 rewardPerNotary = totalReward / validCount;

        for (uint256 i = 0; i < verifications.length; i++) {
            if (verifications[i].isValid) {
                notaryRegistry.distributeReward{value: rewardPerNotary}(
                    verifications[i].notaryAddress,
                    willId
                );

                emit NotaryRewardPaid(willId, verifications[i].notaryAddress, rewardPerNotary);
            }
        }
    }

    /**
     * @notice Execute guardian recovery
     */
    function _executeGuardianRecovery(uint256 willId, address recoveryAddress) internal {
        Will storage will = wills[willId];

        // Transfer testator role
        will.testator = recoveryAddress;
        will.updatedAt = block.timestamp;

        // Reset guardian votes
        Guardian[] storage guardians = willGuardians[willId];
        for (uint256 i = 0; i < guardians.length; i++) {
            guardians[i].hasVotedForRecovery = false;
        }
        guardianRecoveryVotes[willId] = 0;
        guardianRecoveryAddresses[willId] = address(0);

        emit GuardianRecoveryExecuted(willId, recoveryAddress);
    }

    /**
     * @notice Count active wills
     */
    function _countActiveWills() internal view returns (uint256 count) {
        for (uint256 i = 1; i <= willCounter; i++) {
            if (wills[i].status == WillStatus.ACTIVE) {
                count++;
            }
        }
        return count;
    }

    // ============ Receiver Functions ============

    /**
     * @notice Handle receiving ERC721 tokens
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Handle receiving ERC1155 tokens
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @notice Handle receiving batch ERC1155 tokens
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    /**
     * @notice Support interface check
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
