// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title INotaryRegistry
 * @author BaseWill Team
 * @notice Interface for the notary registration and management system
 * @dev Handles notary staking, reputation, and slashing for death verification
 *
 * LEGAL DISCLAIMER: Notaries in the BaseWill system are technical verifiers,
 * not legally recognized notaries in any jurisdiction. Their role is to
 * cryptographically attest to death verification within the protocol.
 */
interface INotaryRegistry {
    // ============ Structs ============

    /**
     * @notice Notary information
     * @param isRegistered Whether the notary is currently registered
     * @param stake Amount of ETH staked
     * @param reputationScore Reputation score (0-100)
     * @param totalVerifications Number of verifications submitted
     * @param successfulVerifications Verifications that led to valid executions
     * @param registrationTime When notary registered
     * @param lastActivityTime Last verification activity
     * @param pendingWithdrawal Amount pending withdrawal
     * @param withdrawalRequestTime When withdrawal was requested
     * @param slashedAmount Total amount slashed historically
     */
    struct NotaryInfo {
        bool isRegistered;
        uint256 stake;
        uint256 reputationScore;
        uint256 totalVerifications;
        uint256 successfulVerifications;
        uint256 registrationTime;
        uint256 lastActivityTime;
        uint256 pendingWithdrawal;
        uint256 withdrawalRequestTime;
        uint256 slashedAmount;
    }

    /**
     * @notice Notary verification record
     * @param willId Will that was verified
     * @param verificationTime When verification was submitted
     * @param proofHash IPFS hash of proof
     * @param wasSuccessful Whether will was successfully executed
     * @param rewardReceived Reward received for this verification
     */
    struct VerificationRecord {
        uint256 willId;
        uint256 verificationTime;
        bytes32 proofHash;
        bool wasSuccessful;
        uint256 rewardReceived;
    }

    // ============ Events ============

    /**
     * @notice Emitted when new notary registers
     * @param notary Notary address
     * @param stake Initial stake amount
     * @param registrationTime Registration timestamp
     */
    event NotaryRegistered(
        address indexed notary,
        uint256 stake,
        uint256 registrationTime
    );

    /**
     * @notice Emitted when notary increases stake
     * @param notary Notary address
     * @param additionalStake Amount added
     * @param totalStake New total stake
     */
    event StakeIncreased(
        address indexed notary,
        uint256 additionalStake,
        uint256 totalStake
    );

    /**
     * @notice Emitted when withdrawal is requested
     * @param notary Notary address
     * @param amount Amount requested
     * @param availableAt When withdrawal becomes available
     */
    event WithdrawalRequested(
        address indexed notary,
        uint256 amount,
        uint256 availableAt
    );

    /**
     * @notice Emitted when withdrawal is completed
     * @param notary Notary address
     * @param amount Amount withdrawn
     */
    event WithdrawalCompleted(
        address indexed notary,
        uint256 amount
    );

    /**
     * @notice Emitted when withdrawal is cancelled
     * @param notary Notary address
     * @param amount Amount that was pending
     */
    event WithdrawalCancelled(
        address indexed notary,
        uint256 amount
    );

    /**
     * @notice Emitted when notary is slashed
     * @param notary Notary address
     * @param amount Amount slashed
     * @param reason Slashing reason
     * @param willId Related will (if applicable)
     */
    event NotarySlashed(
        address indexed notary,
        uint256 amount,
        string reason,
        uint256 willId
    );

    /**
     * @notice Emitted when notary reputation changes
     * @param notary Notary address
     * @param oldScore Previous reputation score
     * @param newScore New reputation score
     * @param reason Reason for change
     */
    event ReputationUpdated(
        address indexed notary,
        uint256 oldScore,
        uint256 newScore,
        string reason
    );

    /**
     * @notice Emitted when notary is removed from registry
     * @param notary Notary address
     * @param reason Removal reason
     * @param remainingStake Stake returned to notary
     */
    event NotaryRemoved(
        address indexed notary,
        string reason,
        uint256 remainingStake
    );

    /**
     * @notice Emitted when notary verification is recorded
     * @param notary Notary address
     * @param willId Will verified
     * @param proofHash IPFS hash of proof
     */
    event VerificationRecorded(
        address indexed notary,
        uint256 indexed willId,
        bytes32 proofHash
    );

    /**
     * @notice Emitted when notary receives reward
     * @param notary Notary address
     * @param willId Related will
     * @param amount Reward amount
     */
    event RewardDistributed(
        address indexed notary,
        uint256 indexed willId,
        uint256 amount
    );

    /**
     * @notice Emitted when minimum stake requirement changes
     * @param oldMinimum Previous minimum
     * @param newMinimum New minimum
     */
    event MinimumStakeUpdated(
        uint256 oldMinimum,
        uint256 newMinimum
    );

    /**
     * @notice Emitted when withdrawal cooldown changes
     * @param oldCooldown Previous cooldown
     * @param newCooldown New cooldown
     */
    event WithdrawalCooldownUpdated(
        uint256 oldCooldown,
        uint256 newCooldown
    );

    // ============ Errors ============

    error NotaryAlreadyRegistered(address notary);
    error NotaryNotRegistered(address notary);
    error InsufficientStake(uint256 provided, uint256 required);
    error CooldownNotComplete(uint256 availableAt);
    error NoWithdrawalPending();
    error WithdrawalAlreadyPending();
    error InsufficientStakeForWithdrawal(uint256 requested, uint256 available);
    error NotAuthorizedToSlash(address caller);
    error SlashAmountExceedsStake(uint256 amount, uint256 stake);
    error ZeroAddress();
    error ZeroAmount();
    error NotaryInactive(address notary);
    error TransferFailed(address to, uint256 amount);

    // ============ Core Functions ============

    /**
     * @notice Register as a notary by staking ETH
     * @dev Requires minimum stake amount
     */
    function registerNotary() external payable;

    /**
     * @notice Increase stake as existing notary
     */
    function increaseStake() external payable;

    /**
     * @notice Request withdrawal of stake (starts cooldown)
     * @param amount Amount to withdraw
     */
    function requestWithdrawal(uint256 amount) external;

    /**
     * @notice Complete withdrawal after cooldown
     */
    function completeWithdrawal() external;

    /**
     * @notice Cancel pending withdrawal request
     */
    function cancelWithdrawal() external;

    /**
     * @notice Slash notary for false verification (only callable by BaseWill)
     * @param notary Notary address to slash
     * @param amount Amount to slash
     * @param reason Slashing reason
     * @param willId Related will ID
     * @param recipient Address to receive slashed funds
     */
    function slashNotary(
        address notary,
        uint256 amount,
        string calldata reason,
        uint256 willId,
        address recipient
    ) external;

    /**
     * @notice Record verification submission (only callable by BaseWill)
     * @param notary Notary address
     * @param willId Will verified
     * @param proofHash IPFS hash of proof
     */
    function recordVerification(
        address notary,
        uint256 willId,
        bytes32 proofHash
    ) external;

    /**
     * @notice Mark verification as successful and update reputation (only callable by BaseWill)
     * @param notary Notary address
     * @param willId Will that was executed
     */
    function markVerificationSuccessful(
        address notary,
        uint256 willId
    ) external;

    /**
     * @notice Distribute reward to notary (only callable by BaseWill)
     * @param notary Notary address
     * @param willId Related will
     */
    function distributeReward(
        address notary,
        uint256 willId
    ) external payable;

    /**
     * @notice Remove notary from registry (governance only)
     * @param notary Notary address
     * @param reason Removal reason
     */
    function removeNotary(address notary, string calldata reason) external;

    /**
     * @notice Voluntarily deregister as notary
     * @dev Can only be done if no pending verifications
     */
    function deregister() external;

    // ============ Admin Functions ============

    /**
     * @notice Update minimum stake requirement (owner only)
     * @param newMinimum New minimum stake
     */
    function setMinimumStake(uint256 newMinimum) external;

    /**
     * @notice Update withdrawal cooldown (owner only)
     * @param newCooldown New cooldown period in seconds
     */
    function setWithdrawalCooldown(uint256 newCooldown) external;

    /**
     * @notice Set BaseWill contract address (owner only, once)
     * @param baseWill BaseWill contract address
     */
    function setBaseWillContract(address baseWill) external;

    // ============ View Functions ============

    /**
     * @notice Get notary information
     * @param notary Notary address
     * @return info NotaryInfo struct
     */
    function getNotaryInfo(address notary) external view returns (NotaryInfo memory info);

    /**
     * @notice Check if address is an active notary
     * @param notary Address to check
     * @return isActive True if registered and has sufficient stake
     */
    function isActiveNotary(address notary) external view returns (bool isActive);

    /**
     * @notice Get notary's verification history
     * @param notary Notary address
     * @return records Array of VerificationRecord structs
     */
    function getVerificationHistory(address notary) external view returns (VerificationRecord[] memory records);

    /**
     * @notice Get total number of registered notaries
     * @return count Number of active notaries
     */
    function getNotaryCount() external view returns (uint256 count);

    /**
     * @notice Get list of all registered notaries
     * @param offset Starting index
     * @param limit Maximum results
     * @return notaries Array of notary addresses
     */
    function getRegisteredNotaries(uint256 offset, uint256 limit) external view returns (address[] memory notaries);

    /**
     * @notice Get top notaries by reputation
     * @param count Number of notaries to return
     * @return notaries Array of notary addresses sorted by reputation
     */
    function getTopNotaries(uint256 count) external view returns (address[] memory notaries);

    /**
     * @notice Get minimum stake requirement
     * @return minimum Minimum stake in wei
     */
    function getMinimumStake() external view returns (uint256 minimum);

    /**
     * @notice Get withdrawal cooldown period
     * @return cooldown Cooldown in seconds
     */
    function getWithdrawalCooldown() external view returns (uint256 cooldown);

    /**
     * @notice Get total stake across all notaries
     * @return totalStake Total staked amount
     */
    function getTotalStake() external view returns (uint256 totalStake);

    /**
     * @notice Check if notary has pending verification for a will
     * @param notary Notary address
     * @param willId Will identifier
     * @return hasPending True if verification pending
     */
    function hasPendingVerification(address notary, uint256 willId) external view returns (bool hasPending);

    /**
     * @notice Get notary's pending verification count
     * @param notary Notary address
     * @return count Number of pending verifications
     */
    function getPendingVerificationCount(address notary) external view returns (uint256 count);
}
