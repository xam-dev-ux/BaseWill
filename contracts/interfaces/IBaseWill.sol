// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBaseWill
 * @author BaseWill Team
 * @notice Interface for the BaseWill decentralized inheritance platform
 * @dev Defines all enums, structs, events, and function signatures for will management
 *
 * LEGAL DISCLAIMER: BaseWill is a technical tool for asset distribution and does NOT
 * constitute legal advice. Users should consult qualified estate planning attorneys.
 * The enforceability of onchain wills varies by jurisdiction. BaseWill provides
 * infrastructure only and makes no guarantees about legal validity.
 */
interface IBaseWill {
    // ============ Enums ============

    /**
     * @notice Status of a will throughout its lifecycle
     * @param DRAFT Will created but not yet activated
     * @param ACTIVE Will is active and monitoring testator activity
     * @param TRIGGERED Inactivity threshold reached, grace period started
     * @param DISPUTED Will execution contested, assets frozen
     * @param EXECUTED Assets have been distributed to beneficiaries
     * @param CANCELLED Testator cancelled the will
     * @param REVOKED Will revoked by governance due to dispute
     */
    enum WillStatus {
        DRAFT,
        ACTIVE,
        TRIGGERED,
        DISPUTED,
        EXECUTED,
        CANCELLED,
        REVOKED
    }

    /**
     * @notice How will activation is triggered
     * @param TIME_BASED Automatic after inactivity period expires
     * @param NOTARY_VERIFIED Requires M-of-N notaries to verify death
     * @param HYBRID Both time-based AND notary verification required
     */
    enum ActivationMode {
        TIME_BASED,
        NOTARY_VERIFIED,
        HYBRID
    }

    /**
     * @notice Asset distribution timing for beneficiaries
     * @param IMMEDIATE Full amount transferred at execution
     * @param LINEAR Gradual release over specified period
     * @param CLIFF Locked for period, then full release
     * @param MILESTONE Released upon specific conditions being met
     */
    enum VestingType {
        IMMEDIATE,
        LINEAR,
        CLIFF,
        MILESTONE
    }

    /**
     * @notice Types of assets that can be included in a will
     * @param ETH Native Ether
     * @param ERC20 Fungible tokens
     * @param ERC721 Non-fungible tokens (NFTs)
     * @param ERC1155 Multi-tokens (fungible and non-fungible)
     */
    enum AssetType {
        ETH,
        ERC20,
        ERC721,
        ERC1155
    }

    /**
     * @notice Privacy level for will details
     * @param PUBLIC All details visible onchain
     * @param SEMI_PRIVATE Only encrypted hashes visible
     * @param PRIVATE Full encryption, revealed only upon execution
     */
    enum PrivacyMode {
        PUBLIC,
        SEMI_PRIVATE,
        PRIVATE
    }

    /**
     * @notice Type of activity recorded for dead man's switch
     * @param MANUAL_CHECK_IN Explicit check-in call
     * @param TRANSACTION Any transaction from testator
     * @param WILL_UPDATE Modification to will
     * @param ASSET_DEPOSIT Deposit to will contract
     * @param DELEGATED_CHECK_IN Check-in by authorized delegate
     */
    enum ActivityType {
        MANUAL_CHECK_IN,
        TRANSACTION,
        WILL_UPDATE,
        ASSET_DEPOSIT,
        DELEGATED_CHECK_IN
    }

    /**
     * @notice Severity of inactivity warning
     * @param NORMAL 30 days before threshold
     * @param URGENT 7 days before threshold
     * @param CRITICAL 24 hours before threshold
     */
    enum WarningSeverity {
        NORMAL,
        URGENT,
        CRITICAL
    }

    /**
     * @notice Outcome of a dispute resolution
     * @param PENDING Dispute still being reviewed
     * @param UPHELD Dispute was valid, execution cancelled/modified
     * @param REJECTED Dispute was invalid, execution proceeds
     */
    enum DisputeOutcome {
        PENDING,
        UPHELD,
        REJECTED
    }

    // ============ Structs ============

    /**
     * @notice Configuration for vesting schedule
     * @param vestingType Type of vesting (immediate, linear, cliff, milestone)
     * @param startDelay Delay before vesting begins (in seconds)
     * @param duration Total vesting duration (in seconds)
     * @param cliffDuration Cliff period before any vesting (in seconds)
     * @param releaseInterval Interval between releases for linear vesting (in seconds)
     * @param milestoneCondition Hash of milestone condition (for MILESTONE type)
     */
    struct VestingSchedule {
        VestingType vestingType;
        uint256 startDelay;
        uint256 duration;
        uint256 cliffDuration;
        uint256 releaseInterval;
        bytes32 milestoneCondition;
    }

    /**
     * @notice Beneficiary information
     * @param beneficiaryAddress Wallet address to receive assets
     * @param allocationBps Allocation percentage in basis points (100 = 1%)
     * @param vestingSchedule How assets are released over time
     * @param isPrimary True if primary beneficiary, false if contingent
     * @param hasAccepted Whether beneficiary has accepted designation
     * @param labelHash IPFS hash of label/name (offchain)
     * @param amountClaimed Total amount already claimed
     * @param lastClaimTime Timestamp of last claim
     */
    struct Beneficiary {
        address beneficiaryAddress;
        uint256 allocationBps;
        VestingSchedule vestingSchedule;
        bool isPrimary;
        bool hasAccepted;
        bytes32 labelHash;
        uint256 amountClaimed;
        uint256 lastClaimTime;
    }

    /**
     * @notice Asset included in a will
     * @param assetType Type of asset (ETH, ERC20, ERC721, ERC1155)
     * @param contractAddress Token contract address (address(0) for ETH)
     * @param tokenId Specific token ID for NFTs (0 for fungibles)
     * @param amount Amount for fungible assets (1 for NFTs)
     * @param isIncluded Whether asset is actively included
     */
    struct Asset {
        AssetType assetType;
        address contractAddress;
        uint256 tokenId;
        uint256 amount;
        bool isIncluded;
    }

    /**
     * @notice Notary verification record
     * @param notaryAddress Address of the verifying notary
     * @param verificationTime Timestamp of verification
     * @param proofHash IPFS hash of death certificate/proof
     * @param isValid Whether verification is still valid
     */
    struct NotaryVerification {
        address notaryAddress;
        uint256 verificationTime;
        bytes32 proofHash;
        bool isValid;
    }

    /**
     * @notice Dead Man's Switch configuration
     * @param checkInFrequency Required check-in frequency (in seconds)
     * @param missedCheckInsBeforeActivation Number of missed check-ins before trigger
     * @param gracePeriod Time window to cancel after trigger (in seconds)
     */
    struct DeadManSwitch {
        uint256 checkInFrequency;
        uint256 missedCheckInsBeforeActivation;
        uint256 gracePeriod;
    }

    /**
     * @notice Dispute filed against will execution
     * @param disputer Address that filed the dispute
     * @param disputeTime Timestamp of dispute filing
     * @param reasonHash IPFS hash of dispute reason and evidence
     * @param bondAmount ETH bond deposited
     * @param outcome Resolution outcome
     * @param resolvedTime Timestamp of resolution (0 if pending)
     */
    struct Dispute {
        address disputer;
        uint256 disputeTime;
        bytes32 reasonHash;
        uint256 bondAmount;
        DisputeOutcome outcome;
        uint256 resolvedTime;
    }

    /**
     * @notice Guardian for social recovery
     * @param guardianAddress Guardian's wallet address
     * @param hasVotedForRecovery Whether guardian voted for recovery
     * @param addedTime When guardian was added
     */
    struct Guardian {
        address guardianAddress;
        bool hasVotedForRecovery;
        uint256 addedTime;
    }

    /**
     * @notice Joint will configuration for couples
     * @param coTestator Address of the co-testator
     * @param coTestatorLastActivity Last activity timestamp of co-testator
     * @param requireBothInactive Whether both must be inactive to trigger
     * @param survivorGetsAll Whether survivor receives full control
     */
    struct JointWillConfig {
        address coTestator;
        uint256 coTestatorLastActivity;
        bool requireBothInactive;
        bool survivorGetsAll;
    }

    /**
     * @notice Trust configuration for ongoing management
     * @param trusteeAddress Address managing the trust
     * @param beneficiaryAge Age when beneficiary gains full control
     * @param beneficiaryBirthTimestamp Beneficiary's birth timestamp
     * @param spendingLimitPerPeriod Maximum spending per period
     * @param periodDuration Duration of spending period (in seconds)
     * @param whitelistedAddresses Addresses trustee can send to
     */
    struct TrustConfig {
        address trusteeAddress;
        uint256 beneficiaryAge;
        uint256 beneficiaryBirthTimestamp;
        uint256 spendingLimitPerPeriod;
        uint256 periodDuration;
        address[] whitelistedAddresses;
    }

    /**
     * @notice Complete will structure
     * @param id Unique will identifier
     * @param testator Creator of the will
     * @param status Current status of the will
     * @param activationMode How will is triggered
     * @param privacyMode Privacy level
     * @param inactivityThreshold Time before will triggers (in seconds)
     * @param gracePeriod Time to cancel after trigger (in seconds)
     * @param disputePeriod Time window for disputes (in seconds)
     * @param createdAt Creation timestamp
     * @param updatedAt Last update timestamp
     * @param lastActivity Last activity timestamp
     * @param triggerTime When will was triggered (0 if not triggered)
     * @param executionTime When will was executed (0 if not executed)
     * @param metadataHash IPFS hash of full will document
     * @param encryptedDataHash Hash of encrypted beneficiary data (for privacy mode)
     * @param backupExecutor Address that can execute if notaries fail
     * @param version Will version number (increments on major updates)
     */
    struct Will {
        uint256 id;
        address testator;
        WillStatus status;
        ActivationMode activationMode;
        PrivacyMode privacyMode;
        uint256 inactivityThreshold;
        uint256 gracePeriod;
        uint256 disputePeriod;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 lastActivity;
        uint256 triggerTime;
        uint256 executionTime;
        bytes32 metadataHash;
        bytes32 encryptedDataHash;
        address backupExecutor;
        uint256 version;
    }

    /**
     * @notice Statistics for a testator
     * @param totalWills Number of wills created
     * @param totalValue Total estimated value across wills
     * @param totalBeneficiaries Total beneficiaries across wills
     * @param lastActivity Most recent activity timestamp
     * @param activeWills Number of active wills
     */
    struct TestatorStats {
        uint256 totalWills;
        uint256 totalValue;
        uint256 totalBeneficiaries;
        uint256 lastActivity;
        uint256 activeWills;
    }

    /**
     * @notice Platform-wide statistics
     * @param totalValueSecured Total ETH value secured in all wills
     * @param totalWillsCreated Number of wills ever created
     * @param activeWills Number of currently active wills
     * @param executedWills Number of successfully executed wills
     * @param totalDistributed Total value distributed to beneficiaries
     * @param registeredNotaries Number of active notaries
     */
    struct PlatformStats {
        uint256 totalValueSecured;
        uint256 totalWillsCreated;
        uint256 activeWills;
        uint256 executedWills;
        uint256 totalDistributed;
        uint256 registeredNotaries;
    }

    // ============ Events ============

    /**
     * @notice Emitted when a new will is created
     * @param willId Unique identifier of the will
     * @param testator Address of the will creator
     * @param activationMode How the will is triggered
     * @param inactivityThreshold Time period before activation
     * @param beneficiaryCount Number of beneficiaries
     */
    event WillCreated(
        uint256 indexed willId,
        address indexed testator,
        ActivationMode activationMode,
        uint256 inactivityThreshold,
        uint256 beneficiaryCount
    );

    /**
     * @notice Emitted when a will is updated
     * @param willId Will identifier
     * @param field Name of the updated field
     * @param oldValueHash Hash of old value
     * @param newValueHash Hash of new value
     * @param version New version number
     */
    event WillUpdated(
        uint256 indexed willId,
        string field,
        bytes32 oldValueHash,
        bytes32 newValueHash,
        uint256 version
    );

    /**
     * @notice Emitted when a beneficiary is added
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param allocationBps Allocation in basis points
     */
    event BeneficiaryAdded(
        uint256 indexed willId,
        address indexed beneficiary,
        uint256 allocationBps
    );

    /**
     * @notice Emitted when a beneficiary is removed
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     */
    event BeneficiaryRemoved(
        uint256 indexed willId,
        address indexed beneficiary
    );

    /**
     * @notice Emitted when a beneficiary accepts or rejects designation
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param accepted True if accepted, false if rejected
     */
    event BeneficiaryResponse(
        uint256 indexed willId,
        address indexed beneficiary,
        bool accepted
    );

    /**
     * @notice Emitted when testator activity is recorded
     * @param willId Will identifier
     * @param activityType Type of activity
     * @param timestamp Activity timestamp
     */
    event ActivityRecorded(
        uint256 indexed willId,
        ActivityType activityType,
        uint256 timestamp
    );

    /**
     * @notice Emitted when inactivity threshold is approaching
     * @param willId Will identifier
     * @param daysRemaining Days until trigger
     * @param severity Warning severity level
     */
    event InactivityWarning(
        uint256 indexed willId,
        uint256 daysRemaining,
        WarningSeverity severity
    );

    /**
     * @notice Emitted when will enters triggered state
     * @param willId Will identifier
     * @param reason Reason for trigger (time-based or notary)
     * @param timestamp Trigger timestamp
     * @param gracePeriodEnd When grace period ends
     */
    event WillTriggered(
        uint256 indexed willId,
        string reason,
        uint256 timestamp,
        uint256 gracePeriodEnd
    );

    /**
     * @notice Emitted when grace period starts
     * @param willId Will identifier
     * @param endDate Grace period end timestamp
     */
    event GracePeriodStarted(
        uint256 indexed willId,
        uint256 endDate
    );

    /**
     * @notice Emitted when testator cancels during grace period
     * @param willId Will identifier
     * @param testator Testator address
     */
    event GracePeriodCancelled(
        uint256 indexed willId,
        address indexed testator
    );

    /**
     * @notice Emitted when notary submits death verification
     * @param willId Will identifier
     * @param notary Notary address
     * @param proofHash IPFS hash of proof
     * @param currentVerificationCount Total verifications so far
     */
    event NotaryVerificationSubmitted(
        uint256 indexed willId,
        address indexed notary,
        bytes32 proofHash,
        uint256 currentVerificationCount
    );

    /**
     * @notice Emitted when dispute period starts
     * @param willId Will identifier
     * @param endDate Dispute period end timestamp
     */
    event DisputePeriodStarted(
        uint256 indexed willId,
        uint256 endDate
    );

    /**
     * @notice Emitted when dispute is filed
     * @param willId Will identifier
     * @param disputer Address filing dispute
     * @param reasonHash IPFS hash of reason
     * @param bondAmount ETH bond deposited
     */
    event DisputeFiled(
        uint256 indexed willId,
        address indexed disputer,
        bytes32 reasonHash,
        uint256 bondAmount
    );

    /**
     * @notice Emitted when dispute is resolved
     * @param willId Will identifier
     * @param outcome Resolution outcome
     * @param refundedParty Address receiving bond refund
     */
    event DisputeResolved(
        uint256 indexed willId,
        DisputeOutcome outcome,
        address refundedParty
    );

    /**
     * @notice Emitted when will execution begins
     * @param willId Will identifier
     * @param totalValue Total value being distributed
     * @param executor Address that triggered execution
     */
    event WillExecutionStarted(
        uint256 indexed willId,
        uint256 totalValue,
        address indexed executor
    );

    /**
     * @notice Emitted when assets are distributed to a beneficiary
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param assetType Type of asset
     * @param amount Amount distributed
     * @param vestingType Vesting schedule type
     */
    event AssetDistributed(
        uint256 indexed willId,
        address indexed beneficiary,
        AssetType assetType,
        uint256 amount,
        VestingType vestingType
    );

    /**
     * @notice Emitted when vested assets are released
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param amount Amount released
     * @param releaseNumber Which release this is (1, 2, 3...)
     */
    event VestingReleased(
        uint256 indexed willId,
        address indexed beneficiary,
        uint256 amount,
        uint256 releaseNumber
    );

    /**
     * @notice Emitted when will is cancelled
     * @param willId Will identifier
     * @param testator Testator address
     * @param reason Cancellation reason
     */
    event WillCancelled(
        uint256 indexed willId,
        address indexed testator,
        string reason
    );

    /**
     * @notice Emitted when emergency withdrawal is initiated
     * @param willId Will identifier
     * @param cooldownEnd When cooldown period ends
     */
    event EmergencyWithdrawalInitiated(
        uint256 indexed willId,
        uint256 cooldownEnd
    );

    /**
     * @notice Emitted when emergency withdrawal completes
     * @param willId Will identifier
     * @param testator Testator address
     * @param totalValue Total value withdrawn
     */
    event EmergencyWithdrawalCompleted(
        uint256 indexed willId,
        address indexed testator,
        uint256 totalValue
    );

    /**
     * @notice Emitted when notary stake is slashed
     * @param notary Notary address
     * @param willId Related will identifier
     * @param reason Slashing reason
     * @param amountSlashed Amount of stake slashed
     */
    event NotaryStakePenalized(
        address indexed notary,
        uint256 indexed willId,
        string reason,
        uint256 amountSlashed
    );

    /**
     * @notice Emitted when platform fee is distributed
     * @param willId Will identifier
     * @param totalFee Total fee amount
     * @param wallets Commission wallet addresses
     * @param amounts Amount to each wallet
     */
    event FeeDistributed(
        uint256 indexed willId,
        uint256 totalFee,
        address[] wallets,
        uint256[] amounts
    );

    /**
     * @notice Emitted when notary receives reward
     * @param willId Will identifier
     * @param notary Notary address
     * @param amount Reward amount
     */
    event NotaryRewardPaid(
        uint256 indexed willId,
        address indexed notary,
        uint256 amount
    );

    /**
     * @notice Emitted when executor receives reward
     * @param willId Will identifier
     * @param executor Executor address
     * @param amount Reward amount
     */
    event ExecutorRewardPaid(
        uint256 indexed willId,
        address indexed executor,
        uint256 amount
    );

    /**
     * @notice Emitted when guardian is added
     * @param willId Will identifier
     * @param guardian Guardian address
     */
    event GuardianAdded(
        uint256 indexed willId,
        address indexed guardian
    );

    /**
     * @notice Emitted when guardian votes for recovery
     * @param willId Will identifier
     * @param guardian Guardian address
     * @param totalVotes Current vote count
     */
    event GuardianVotedForRecovery(
        uint256 indexed willId,
        address indexed guardian,
        uint256 totalVotes
    );

    /**
     * @notice Emitted when guardian recovery is executed
     * @param willId Will identifier
     * @param recoveryAddress New controlling address
     */
    event GuardianRecoveryExecuted(
        uint256 indexed willId,
        address indexed recoveryAddress
    );

    /**
     * @notice Emitted when configuration is updated
     * @param parameter Name of the parameter
     * @param oldValue Previous value
     * @param newValue New value
     */
    event ConfigurationUpdated(
        string parameter,
        uint256 oldValue,
        uint256 newValue
    );

    /**
     * @notice Emitted when asset is added to will
     * @param willId Will identifier
     * @param assetType Type of asset
     * @param contractAddress Token contract address
     * @param tokenId Token ID (for NFTs)
     * @param amount Amount added
     */
    event AssetAdded(
        uint256 indexed willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId,
        uint256 amount
    );

    /**
     * @notice Emitted when asset is removed from will
     * @param willId Will identifier
     * @param assetType Type of asset
     * @param contractAddress Token contract address
     * @param tokenId Token ID (for NFTs)
     */
    event AssetRemoved(
        uint256 indexed willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId
    );

    // ============ Errors ============

    error WillNotFound(uint256 willId);
    error NotTestator(address caller, uint256 willId);
    error NotBeneficiary(address caller, uint256 willId);
    error InvalidStatus(WillStatus current, WillStatus required);
    error InvalidAllocation(uint256 totalBps);
    error MaxBeneficiariesExceeded(uint256 count, uint256 max);
    error InsufficientNotaries(uint256 count, uint256 required);
    error NotaryNotRegistered(address notary);
    error AlreadyVerified(address notary, uint256 willId);
    error GracePeriodNotEnded(uint256 endsAt);
    error DisputePeriodNotEnded(uint256 endsAt);
    error DisputePeriodEnded(uint256 endedAt);
    error InsufficientBond(uint256 sent, uint256 required);
    error CooldownNotComplete(uint256 endsAt);
    error NoAssetsToDistribute();
    error TransferFailed(address to, uint256 amount);
    error VestingNotReady(uint256 nextReleaseTime);
    error InvalidInactivityThreshold(uint256 provided, uint256 min, uint256 max);
    error AlreadyTriggered(uint256 willId);
    error NotTriggered(uint256 willId);
    error NotDelegatedCheckInAddress(address caller);
    error ZeroAddress();
    error InvalidPercentage(uint256 percentage);
    error WillAlreadyExists(uint256 willId);
    error UnauthorizedNotary(address caller);
    error InsufficientVerifications(uint256 current, uint256 required);

    // ============ Core Functions ============

    /**
     * @notice Create a new will
     * @param activationMode How the will should be triggered
     * @param inactivityThreshold Time before will triggers (in seconds)
     * @param gracePeriod Time to cancel after trigger (in seconds)
     * @param disputePeriod Time window for disputes (in seconds)
     * @param metadataHash IPFS hash of will metadata
     * @param backupExecutor Address that can execute if notaries fail
     * @return willId The ID of the created will
     */
    function createWill(
        ActivationMode activationMode,
        uint256 inactivityThreshold,
        uint256 gracePeriod,
        uint256 disputePeriod,
        bytes32 metadataHash,
        address backupExecutor
    ) external returns (uint256 willId);

    /**
     * @notice Update will metadata
     * @param willId Will identifier
     * @param newMetadataHash New IPFS hash of metadata
     */
    function updateWillMetadata(uint256 willId, bytes32 newMetadataHash) external;

    /**
     * @notice Cancel a will and return assets
     * @param willId Will identifier
     * @param reason Cancellation reason
     */
    function cancelWill(uint256 willId, string calldata reason) external;

    /**
     * @notice Add a beneficiary to a will
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param allocationBps Allocation in basis points
     * @param vestingSchedule Vesting configuration
     * @param isPrimary Whether this is a primary beneficiary
     * @param labelHash IPFS hash of label/name
     */
    function addBeneficiary(
        uint256 willId,
        address beneficiary,
        uint256 allocationBps,
        VestingSchedule calldata vestingSchedule,
        bool isPrimary,
        bytes32 labelHash
    ) external;

    /**
     * @notice Remove a beneficiary from a will
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     */
    function removeBeneficiary(uint256 willId, address beneficiary) external;

    /**
     * @notice Update beneficiary allocation
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @param newAllocationBps New allocation in basis points
     */
    function updateBeneficiaryAllocation(
        uint256 willId,
        address beneficiary,
        uint256 newAllocationBps
    ) external;

    /**
     * @notice Add an asset to a will
     * @param willId Will identifier
     * @param assetType Type of asset
     * @param contractAddress Token contract address
     * @param tokenId Token ID (for NFTs)
     * @param amount Amount to include
     */
    function addAsset(
        uint256 willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId,
        uint256 amount
    ) external;

    /**
     * @notice Remove an asset from a will
     * @param willId Will identifier
     * @param assetType Type of asset
     * @param contractAddress Token contract address
     * @param tokenId Token ID (for NFTs)
     */
    function removeAsset(
        uint256 willId,
        AssetType assetType,
        address contractAddress,
        uint256 tokenId
    ) external;

    /**
     * @notice Manual check-in to prove liveness
     * @param willId Will identifier
     */
    function checkIn(uint256 willId) external;

    /**
     * @notice Check-in on behalf of testator (delegated)
     * @param willId Will identifier
     */
    function delegatedCheckIn(uint256 willId) external;

    /**
     * @notice Assign notaries to a will
     * @param willId Will identifier
     * @param notaries Array of notary addresses
     * @param requiredVerifications M-of-N threshold
     */
    function assignNotaries(
        uint256 willId,
        address[] calldata notaries,
        uint256 requiredVerifications
    ) external;

    /**
     * @notice Submit death verification as notary
     * @param willId Will identifier
     * @param proofHash IPFS hash of death certificate/proof
     */
    function submitVerification(uint256 willId, bytes32 proofHash) external;

    /**
     * @notice Trigger will activation (anyone can call if conditions met)
     * @param willId Will identifier
     */
    function triggerWill(uint256 willId) external;

    /**
     * @notice Cancel trigger during grace period (testator only)
     * @param willId Will identifier
     */
    function cancelTrigger(uint256 willId) external;

    /**
     * @notice Execute will and distribute assets
     * @param willId Will identifier
     */
    function executeWill(uint256 willId) external;

    /**
     * @notice Claim vested assets (beneficiary only)
     * @param willId Will identifier
     */
    function claimVestedAssets(uint256 willId) external;

    /**
     * @notice File dispute against will execution
     * @param willId Will identifier
     * @param reasonHash IPFS hash of dispute reason
     */
    function fileDispute(uint256 willId, bytes32 reasonHash) external payable;

    /**
     * @notice Resolve dispute (governance only)
     * @param willId Will identifier
     * @param disputeIndex Index of the dispute
     * @param outcome Resolution outcome
     */
    function resolveDispute(
        uint256 willId,
        uint256 disputeIndex,
        DisputeOutcome outcome
    ) external;

    /**
     * @notice Initiate emergency withdrawal
     * @param willId Will identifier
     */
    function initiateEmergencyWithdrawal(uint256 willId) external;

    /**
     * @notice Complete emergency withdrawal after cooldown
     * @param willId Will identifier
     */
    function completeEmergencyWithdrawal(uint256 willId) external;

    /**
     * @notice Cancel emergency withdrawal request
     * @param willId Will identifier
     */
    function cancelEmergencyWithdrawal(uint256 willId) external;

    /**
     * @notice Accept beneficiary designation
     * @param willId Will identifier
     */
    function acceptBeneficiaryDesignation(uint256 willId) external;

    /**
     * @notice Reject beneficiary designation
     * @param willId Will identifier
     */
    function rejectBeneficiaryDesignation(uint256 willId) external;

    /**
     * @notice Add guardian for social recovery
     * @param willId Will identifier
     * @param guardian Guardian address
     */
    function addGuardian(uint256 willId, address guardian) external;

    /**
     * @notice Remove guardian
     * @param willId Will identifier
     * @param guardian Guardian address
     */
    function removeGuardian(uint256 willId, address guardian) external;

    /**
     * @notice Vote for guardian recovery
     * @param willId Will identifier
     * @param recoveryAddress Address to transfer control to
     */
    function voteForGuardianRecovery(uint256 willId, address recoveryAddress) external;

    /**
     * @notice Set privacy mode for will
     * @param willId Will identifier
     * @param mode Privacy mode
     * @param encryptedDataHash Hash of encrypted data
     */
    function setPrivacyMode(
        uint256 willId,
        PrivacyMode mode,
        bytes32 encryptedDataHash
    ) external;

    /**
     * @notice Add delegated check-in address
     * @param willId Will identifier
     * @param delegate Address authorized to check in
     */
    function addDelegatedCheckIn(uint256 willId, address delegate) external;

    /**
     * @notice Remove delegated check-in address
     * @param willId Will identifier
     * @param delegate Address to remove
     */
    function removeDelegatedCheckIn(uint256 willId, address delegate) external;

    /**
     * @notice Deposit ETH to will contract
     * @param willId Will identifier
     */
    function depositETH(uint256 willId) external payable;

    // ============ View Functions ============

    /**
     * @notice Get will details
     * @param willId Will identifier
     * @return will The Will struct
     */
    function getWill(uint256 willId) external view returns (Will memory will);

    /**
     * @notice Get all wills for a testator
     * @param testator Testator address
     * @return willIds Array of will IDs
     */
    function getTestatorWills(address testator) external view returns (uint256[] memory willIds);

    /**
     * @notice Get all wills where address is beneficiary
     * @param beneficiary Beneficiary address
     * @return willIds Array of will IDs
     */
    function getBeneficiaryWills(address beneficiary) external view returns (uint256[] memory willIds);

    /**
     * @notice Get will status with additional details
     * @param willId Will identifier
     * @return status Current status
     * @return lastActivity Last activity timestamp
     * @return daysUntilTrigger Days until trigger (0 if triggered/executed)
     * @return isTriggered Whether will is triggered
     */
    function getWillStatus(uint256 willId) external view returns (
        WillStatus status,
        uint256 lastActivity,
        uint256 daysUntilTrigger,
        bool isTriggered
    );

    /**
     * @notice Get beneficiaries of a will
     * @param willId Will identifier
     * @return beneficiaries Array of Beneficiary structs
     */
    function getBeneficiaries(uint256 willId) external view returns (Beneficiary[] memory beneficiaries);

    /**
     * @notice Get total value of will assets
     * @param willId Will identifier
     * @return ethBalance ETH balance
     * @return tokenBalances Array of token balances
     * @return nftCount Number of NFTs
     */
    function getWillValue(uint256 willId) external view returns (
        uint256 ethBalance,
        uint256[] memory tokenBalances,
        uint256 nftCount
    );

    /**
     * @notice Get notary verifications for a will
     * @param willId Will identifier
     * @return verifications Array of NotaryVerification structs
     */
    function getNotaryVerifications(uint256 willId) external view returns (NotaryVerification[] memory verifications);

    /**
     * @notice Check if will can be executed
     * @param willId Will identifier
     * @return canExecute True if all conditions met
     */
    function canExecuteWill(uint256 willId) external view returns (bool canExecute);

    /**
     * @notice Estimate distribution amounts
     * @param willId Will identifier
     * @return beneficiaries Array of beneficiary addresses
     * @return amounts Array of amounts each will receive
     * @return platformFee Platform fee amount
     * @return notaryRewards Total notary rewards
     * @return executorReward Executor reward
     */
    function estimateDistribution(uint256 willId) external view returns (
        address[] memory beneficiaries,
        uint256[] memory amounts,
        uint256 platformFee,
        uint256 notaryRewards,
        uint256 executorReward
    );

    /**
     * @notice Get testator statistics
     * @param testator Testator address
     * @return stats TestatorStats struct
     */
    function getTestatorStats(address testator) external view returns (TestatorStats memory stats);

    /**
     * @notice Get platform statistics
     * @return stats PlatformStats struct
     */
    function getPlatformStats() external view returns (PlatformStats memory stats);

    /**
     * @notice Get paginated list of active wills
     * @param offset Starting index
     * @param limit Maximum results
     * @return wills Array of Will structs
     */
    function getActiveWills(uint256 offset, uint256 limit) external view returns (Will[] memory wills);

    /**
     * @notice Get paginated list of triggered wills ready for execution
     * @param offset Starting index
     * @param limit Maximum results
     * @return willIds Array of will IDs
     */
    function getTriggeredWills(uint256 offset, uint256 limit) external view returns (uint256[] memory willIds);

    /**
     * @notice Get all disputed wills
     * @return willIds Array of will IDs with active disputes
     */
    function getDisputedWills() external view returns (uint256[] memory willIds);

    /**
     * @notice Get assets included in a will
     * @param willId Will identifier
     * @return assets Array of Asset structs
     */
    function getWillAssets(uint256 willId) external view returns (Asset[] memory assets);

    /**
     * @notice Get guardians for a will
     * @param willId Will identifier
     * @return guardians Array of Guardian structs
     */
    function getGuardians(uint256 willId) external view returns (Guardian[] memory guardians);

    /**
     * @notice Get disputes for a will
     * @param willId Will identifier
     * @return disputes Array of Dispute structs
     */
    function getDisputes(uint256 willId) external view returns (Dispute[] memory disputes);

    /**
     * @notice Check if address is delegated for check-in
     * @param willId Will identifier
     * @param delegate Address to check
     * @return isDelegated True if authorized
     */
    function isDelegatedCheckIn(uint256 willId, address delegate) external view returns (bool isDelegated);

    /**
     * @notice Get vesting status for a beneficiary
     * @param willId Will identifier
     * @param beneficiary Beneficiary address
     * @return totalAmount Total allocated amount
     * @return vestedAmount Amount currently vested
     * @return claimedAmount Amount already claimed
     * @return nextReleaseTime Next vesting release timestamp
     */
    function getVestingStatus(uint256 willId, address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 vestedAmount,
        uint256 claimedAmount,
        uint256 nextReleaseTime
    );
}
