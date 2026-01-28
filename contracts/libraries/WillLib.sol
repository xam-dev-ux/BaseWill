// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IBaseWill.sol";

/**
 * @title WillLib
 * @author BaseWill Team
 * @notice Library for will validation and helper functions
 * @dev Handles allocation calculations, status transitions, and validation
 */
library WillLib {
    /// @notice Basis points denominator (100% = 10000)
    uint256 constant BPS_DENOMINATOR = 10000;

    /// @notice Minimum inactivity threshold (90 days in seconds)
    uint256 constant MIN_INACTIVITY_THRESHOLD = 90 days;

    /// @notice Maximum inactivity threshold (5 years in seconds)
    uint256 constant MAX_INACTIVITY_THRESHOLD = 1825 days;

    /// @notice Minimum grace period (7 days)
    uint256 constant MIN_GRACE_PERIOD = 7 days;

    /// @notice Maximum grace period (90 days)
    uint256 constant MAX_GRACE_PERIOD = 90 days;

    /// @notice Minimum dispute period (30 days)
    uint256 constant MIN_DISPUTE_PERIOD = 30 days;

    /// @notice Maximum dispute period (180 days)
    uint256 constant MAX_DISPUTE_PERIOD = 180 days;

    // ============ Validation Functions ============

    /**
     * @notice Validate will creation parameters
     * @param inactivityThreshold Inactivity period in seconds
     * @param gracePeriod Grace period in seconds
     * @param disputePeriod Dispute period in seconds
     * @param testator Testator address
     * @return isValid True if parameters are valid
     * @return reason Error reason if invalid
     */
    function validateWillParams(
        uint256 inactivityThreshold,
        uint256 gracePeriod,
        uint256 disputePeriod,
        address testator
    ) internal pure returns (bool isValid, string memory reason) {
        if (testator == address(0)) {
            return (false, "Testator cannot be zero address");
        }

        if (inactivityThreshold < MIN_INACTIVITY_THRESHOLD) {
            return (false, "Inactivity threshold too short");
        }

        if (inactivityThreshold > MAX_INACTIVITY_THRESHOLD) {
            return (false, "Inactivity threshold too long");
        }

        if (gracePeriod < MIN_GRACE_PERIOD) {
            return (false, "Grace period too short");
        }

        if (gracePeriod > MAX_GRACE_PERIOD) {
            return (false, "Grace period too long");
        }

        if (disputePeriod < MIN_DISPUTE_PERIOD) {
            return (false, "Dispute period too short");
        }

        if (disputePeriod > MAX_DISPUTE_PERIOD) {
            return (false, "Dispute period too long");
        }

        return (true, "");
    }

    /**
     * @notice Validate beneficiary allocation
     * @param allocationBps Allocation in basis points
     * @return isValid True if allocation is valid
     * @return reason Error reason if invalid
     */
    function validateAllocation(
        uint256 allocationBps
    ) internal pure returns (bool isValid, string memory reason) {
        if (allocationBps == 0) {
            return (false, "Allocation cannot be zero");
        }

        if (allocationBps > BPS_DENOMINATOR) {
            return (false, "Allocation exceeds 100%");
        }

        return (true, "");
    }

    /**
     * @notice Validate total allocation equals 100%
     * @param beneficiaries Array of beneficiaries
     * @return isValid True if total equals 10000 bps
     * @return totalBps Actual total
     */
    function validateTotalAllocation(
        IBaseWill.Beneficiary[] memory beneficiaries
    ) internal pure returns (bool isValid, uint256 totalBps) {
        totalBps = 0;

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            // Only count primary beneficiaries for total
            if (beneficiaries[i].isPrimary) {
                totalBps += beneficiaries[i].allocationBps;
            }
        }

        // Allow some tolerance for rounding (9990-10000)
        isValid = totalBps >= 9990 && totalBps <= BPS_DENOMINATOR;
        return (isValid, totalBps);
    }

    // ============ Status Transition Functions ============

    /**
     * @notice Check if status transition is valid
     * @param currentStatus Current will status
     * @param newStatus Desired new status
     * @return isValid True if transition is allowed
     */
    function isValidStatusTransition(
        IBaseWill.WillStatus currentStatus,
        IBaseWill.WillStatus newStatus
    ) internal pure returns (bool isValid) {
        // From DRAFT
        if (currentStatus == IBaseWill.WillStatus.DRAFT) {
            return newStatus == IBaseWill.WillStatus.ACTIVE ||
                   newStatus == IBaseWill.WillStatus.CANCELLED;
        }

        // From ACTIVE
        if (currentStatus == IBaseWill.WillStatus.ACTIVE) {
            return newStatus == IBaseWill.WillStatus.TRIGGERED ||
                   newStatus == IBaseWill.WillStatus.CANCELLED;
        }

        // From TRIGGERED
        if (currentStatus == IBaseWill.WillStatus.TRIGGERED) {
            return newStatus == IBaseWill.WillStatus.ACTIVE ||     // Grace period cancel
                   newStatus == IBaseWill.WillStatus.DISPUTED ||
                   newStatus == IBaseWill.WillStatus.EXECUTED ||
                   newStatus == IBaseWill.WillStatus.CANCELLED;
        }

        // From DISPUTED
        if (currentStatus == IBaseWill.WillStatus.DISPUTED) {
            return newStatus == IBaseWill.WillStatus.EXECUTED ||   // Dispute rejected
                   newStatus == IBaseWill.WillStatus.REVOKED ||    // Dispute upheld
                   newStatus == IBaseWill.WillStatus.ACTIVE;       // Reset by governance
        }

        // EXECUTED, CANCELLED, REVOKED are terminal states
        return false;
    }

    /**
     * @notice Check if will can be modified
     * @param status Current will status
     * @return canModify True if will can be edited
     */
    function canModifyWill(
        IBaseWill.WillStatus status
    ) internal pure returns (bool canModify) {
        return status == IBaseWill.WillStatus.DRAFT ||
               status == IBaseWill.WillStatus.ACTIVE;
    }

    /**
     * @notice Check if will can be triggered
     * @param will Will to check
     * @param currentTime Current timestamp
     * @return canTrigger True if trigger conditions met
     * @return reason Reason if cannot trigger
     */
    function canTriggerWill(
        IBaseWill.Will memory will,
        uint256 currentTime
    ) internal pure returns (bool canTrigger, string memory reason) {
        if (will.status != IBaseWill.WillStatus.ACTIVE) {
            return (false, "Will not in ACTIVE status");
        }

        uint256 inactiveTime = currentTime - will.lastActivity;

        if (inactiveTime < will.inactivityThreshold) {
            return (false, "Inactivity threshold not reached");
        }

        return (true, "");
    }

    /**
     * @notice Check if will can be executed
     * @param will Will to check
     * @param currentTime Current timestamp
     * @return canExecute True if execution conditions met
     * @return reason Reason if cannot execute
     */
    function canExecuteWill(
        IBaseWill.Will memory will,
        uint256 currentTime
    ) internal pure returns (bool canExecute, string memory reason) {
        if (will.status != IBaseWill.WillStatus.TRIGGERED) {
            return (false, "Will not in TRIGGERED status");
        }

        // Check grace period has ended
        uint256 gracePeriodEnd = will.triggerTime + will.gracePeriod;
        if (currentTime < gracePeriodEnd) {
            return (false, "Grace period not ended");
        }

        return (true, "");
    }

    /**
     * @notice Check if will is in grace period
     * @param will Will to check
     * @param currentTime Current timestamp
     * @return inGracePeriod True if in grace period
     * @return remainingTime Time remaining in grace period
     */
    function isInGracePeriod(
        IBaseWill.Will memory will,
        uint256 currentTime
    ) internal pure returns (bool inGracePeriod, uint256 remainingTime) {
        if (will.status != IBaseWill.WillStatus.TRIGGERED) {
            return (false, 0);
        }

        uint256 gracePeriodEnd = will.triggerTime + will.gracePeriod;

        if (currentTime >= gracePeriodEnd) {
            return (false, 0);
        }

        return (true, gracePeriodEnd - currentTime);
    }

    /**
     * @notice Check if will is in dispute period
     * @param will Will to check
     * @param currentTime Current timestamp
     * @return inDisputePeriod True if disputes can be filed
     * @return remainingTime Time remaining to file disputes
     */
    function isInDisputePeriod(
        IBaseWill.Will memory will,
        uint256 currentTime
    ) internal pure returns (bool inDisputePeriod, uint256 remainingTime) {
        if (will.status != IBaseWill.WillStatus.TRIGGERED &&
            will.status != IBaseWill.WillStatus.EXECUTED) {
            return (false, 0);
        }

        // Dispute period starts after grace period
        uint256 disputeStart = will.triggerTime + will.gracePeriod;
        uint256 disputeEnd = disputeStart + will.disputePeriod;

        if (currentTime < disputeStart || currentTime >= disputeEnd) {
            return (false, 0);
        }

        return (true, disputeEnd - currentTime);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate days until trigger
     * @param will Will to check
     * @param currentTime Current timestamp
     * @return daysRemaining Days until inactivity threshold (0 if already passed)
     */
    function getDaysUntilTrigger(
        IBaseWill.Will memory will,
        uint256 currentTime
    ) internal pure returns (uint256 daysRemaining) {
        if (will.status != IBaseWill.WillStatus.ACTIVE) {
            return 0;
        }

        uint256 triggerTime = will.lastActivity + will.inactivityThreshold;

        if (currentTime >= triggerTime) {
            return 0;
        }

        return (triggerTime - currentTime) / 1 days;
    }

    /**
     * @notice Calculate beneficiary's share of total value
     * @param totalValue Total value to distribute
     * @param allocationBps Beneficiary's allocation in basis points
     * @return share Calculated share amount
     */
    function calculateShare(
        uint256 totalValue,
        uint256 allocationBps
    ) internal pure returns (uint256 share) {
        return (totalValue * allocationBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Calculate platform fee
     * @param totalValue Total value being distributed
     * @param feePercent Fee percentage in basis points
     * @return fee Fee amount
     */
    function calculateFee(
        uint256 totalValue,
        uint256 feePercent
    ) internal pure returns (uint256 fee) {
        return (totalValue * feePercent) / BPS_DENOMINATOR;
    }

    /**
     * @notice Calculate distribution amounts after fees
     * @param totalValue Total value to distribute
     * @param platformFeeBps Platform fee in basis points
     * @param notaryRewardBps Notary reward in basis points
     * @param executorRewardBps Executor reward in basis points
     * @return platformFee Platform fee amount
     * @return notaryReward Notary reward amount
     * @return executorReward Executor reward amount
     * @return distributableAmount Amount for beneficiaries
     */
    function calculateDistributionAmounts(
        uint256 totalValue,
        uint256 platformFeeBps,
        uint256 notaryRewardBps,
        uint256 executorRewardBps
    ) internal pure returns (
        uint256 platformFee,
        uint256 notaryReward,
        uint256 executorReward,
        uint256 distributableAmount
    ) {
        platformFee = calculateFee(totalValue, platformFeeBps);
        notaryReward = calculateFee(totalValue, notaryRewardBps);
        executorReward = calculateFee(totalValue, executorRewardBps);

        uint256 totalFees = platformFee + notaryReward + executorReward;

        // Ensure we don't underflow
        distributableAmount = totalValue > totalFees ? totalValue - totalFees : 0;

        return (platformFee, notaryReward, executorReward, distributableAmount);
    }

    /**
     * @notice Determine warning severity based on time remaining
     * @param daysRemaining Days until trigger
     * @return severity Warning severity level
     */
    function getWarningSeverity(
        uint256 daysRemaining
    ) internal pure returns (IBaseWill.WarningSeverity severity) {
        if (daysRemaining <= 1) {
            return IBaseWill.WarningSeverity.CRITICAL;
        }
        if (daysRemaining <= 7) {
            return IBaseWill.WarningSeverity.URGENT;
        }
        return IBaseWill.WarningSeverity.NORMAL;
    }

    // ============ Helper Functions ============

    /**
     * @notice Check if address is in beneficiary array
     * @param beneficiaries Array of beneficiaries
     * @param addr Address to check
     * @return exists True if address is a beneficiary
     * @return index Index in array (only valid if exists)
     */
    function findBeneficiary(
        IBaseWill.Beneficiary[] memory beneficiaries,
        address addr
    ) internal pure returns (bool exists, uint256 index) {
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].beneficiaryAddress == addr) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /**
     * @notice Count primary beneficiaries
     * @param beneficiaries Array of beneficiaries
     * @return count Number of primary beneficiaries
     */
    function countPrimaryBeneficiaries(
        IBaseWill.Beneficiary[] memory beneficiaries
    ) internal pure returns (uint256 count) {
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i].isPrimary) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get beneficiary addresses as array
     * @param beneficiaries Array of Beneficiary structs
     * @return addresses Array of beneficiary addresses
     */
    function getBeneficiaryAddresses(
        IBaseWill.Beneficiary[] memory beneficiaries
    ) internal pure returns (address[] memory addresses) {
        addresses = new address[](beneficiaries.length);

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            addresses[i] = beneficiaries[i].beneficiaryAddress;
        }

        return addresses;
    }

    /**
     * @notice Check if activation mode requires notaries
     * @param mode Activation mode
     * @return required True if notaries are required
     */
    function requiresNotaries(
        IBaseWill.ActivationMode mode
    ) internal pure returns (bool required) {
        return mode == IBaseWill.ActivationMode.NOTARY_VERIFIED ||
               mode == IBaseWill.ActivationMode.HYBRID;
    }

    /**
     * @notice Check if activation mode is time-based
     * @param mode Activation mode
     * @return required True if time-based trigger is used
     */
    function isTimeBased(
        IBaseWill.ActivationMode mode
    ) internal pure returns (bool required) {
        return mode == IBaseWill.ActivationMode.TIME_BASED ||
               mode == IBaseWill.ActivationMode.HYBRID;
    }

    /**
     * @notice Create activity record
     * @param activityType Type of activity
     * @param timestamp Activity timestamp
     * @return activity Activity type and timestamp packed
     */
    function packActivity(
        IBaseWill.ActivityType activityType,
        uint256 timestamp
    ) internal pure returns (uint256 activity) {
        return (uint256(activityType) << 248) | (timestamp & ((1 << 248) - 1));
    }

    /**
     * @notice Unpack activity record
     * @param activity Packed activity
     * @return activityType Type of activity
     * @return timestamp Activity timestamp
     */
    function unpackActivity(
        uint256 activity
    ) internal pure returns (IBaseWill.ActivityType activityType, uint256 timestamp) {
        activityType = IBaseWill.ActivityType(activity >> 248);
        timestamp = activity & ((1 << 248) - 1);
        return (activityType, timestamp);
    }
}
