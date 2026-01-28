// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IBaseWill.sol";

/**
 * @title VestingLib
 * @author BaseWill Team
 * @notice Library for vesting schedule calculations
 * @dev Handles immediate, linear, cliff, and milestone vesting types
 */
library VestingLib {
    /// @notice Basis points denominator (100% = 10000)
    uint256 constant BPS_DENOMINATOR = 10000;

    /**
     * @notice Calculate vested amount based on schedule type
     * @param schedule Vesting schedule configuration
     * @param totalAmount Total amount to vest
     * @param startTime When vesting started
     * @param currentTime Current timestamp
     * @return vestedAmount Amount currently vested
     */
    function calculateVestedAmount(
        IBaseWill.VestingSchedule memory schedule,
        uint256 totalAmount,
        uint256 startTime,
        uint256 currentTime
    ) internal pure returns (uint256 vestedAmount) {
        // Apply start delay
        uint256 vestingStart = startTime + schedule.startDelay;

        // If vesting hasn't started yet
        if (currentTime < vestingStart) {
            return 0;
        }

        if (schedule.vestingType == IBaseWill.VestingType.IMMEDIATE) {
            return totalAmount;
        }

        if (schedule.vestingType == IBaseWill.VestingType.LINEAR) {
            return _calculateLinearVesting(
                schedule,
                totalAmount,
                vestingStart,
                currentTime
            );
        }

        if (schedule.vestingType == IBaseWill.VestingType.CLIFF) {
            return _calculateCliffVesting(
                schedule,
                totalAmount,
                vestingStart,
                currentTime
            );
        }

        // MILESTONE type - returns 0 until milestone is manually triggered
        return 0;
    }

    /**
     * @notice Calculate linear vesting amount
     * @dev Releases proportionally over duration with optional release intervals
     */
    function _calculateLinearVesting(
        IBaseWill.VestingSchedule memory schedule,
        uint256 totalAmount,
        uint256 vestingStart,
        uint256 currentTime
    ) private pure returns (uint256) {
        // Check cliff period first
        if (schedule.cliffDuration > 0) {
            uint256 cliffEnd = vestingStart + schedule.cliffDuration;
            if (currentTime < cliffEnd) {
                return 0;
            }
        }

        uint256 elapsed = currentTime - vestingStart;

        // If duration has passed, return full amount
        if (elapsed >= schedule.duration) {
            return totalAmount;
        }

        // If release interval is set, round down to completed intervals
        if (schedule.releaseInterval > 0) {
            uint256 completedIntervals = elapsed / schedule.releaseInterval;
            uint256 totalIntervals = schedule.duration / schedule.releaseInterval;

            if (totalIntervals == 0) {
                return totalAmount;
            }

            return (totalAmount * completedIntervals) / totalIntervals;
        }

        // Continuous linear vesting
        return (totalAmount * elapsed) / schedule.duration;
    }

    /**
     * @notice Calculate cliff vesting amount
     * @dev Nothing released until cliff, then full amount
     */
    function _calculateCliffVesting(
        IBaseWill.VestingSchedule memory schedule,
        uint256 totalAmount,
        uint256 vestingStart,
        uint256 currentTime
    ) private pure returns (uint256) {
        uint256 cliffEnd = vestingStart + schedule.cliffDuration;

        if (currentTime < cliffEnd) {
            return 0;
        }

        return totalAmount;
    }

    /**
     * @notice Calculate next release time for a vesting schedule
     * @param schedule Vesting schedule configuration
     * @param startTime When vesting started
     * @param currentTime Current timestamp
     * @param amountClaimed Amount already claimed
     * @param totalAmount Total amount to vest
     * @return nextReleaseTime Timestamp of next release (0 if fully vested)
     */
    function getNextReleaseTime(
        IBaseWill.VestingSchedule memory schedule,
        uint256 startTime,
        uint256 currentTime,
        uint256 amountClaimed,
        uint256 totalAmount
    ) internal pure returns (uint256 nextReleaseTime) {
        // If fully claimed, no next release
        if (amountClaimed >= totalAmount) {
            return 0;
        }

        uint256 vestingStart = startTime + schedule.startDelay;

        // Immediate vesting - release now if not claimed
        if (schedule.vestingType == IBaseWill.VestingType.IMMEDIATE) {
            return currentTime < vestingStart ? vestingStart : currentTime;
        }

        // Linear vesting with intervals
        if (schedule.vestingType == IBaseWill.VestingType.LINEAR) {
            if (currentTime < vestingStart) {
                if (schedule.cliffDuration > 0) {
                    return vestingStart + schedule.cliffDuration;
                }
                return vestingStart;
            }

            // Check cliff
            if (schedule.cliffDuration > 0 && currentTime < vestingStart + schedule.cliffDuration) {
                return vestingStart + schedule.cliffDuration;
            }

            // Calculate next interval
            if (schedule.releaseInterval > 0) {
                uint256 elapsed = currentTime - vestingStart;
                uint256 nextInterval = ((elapsed / schedule.releaseInterval) + 1) * schedule.releaseInterval;

                if (nextInterval > schedule.duration) {
                    return 0; // Fully vested
                }

                return vestingStart + nextInterval;
            }

            // Continuous - available now
            return currentTime;
        }

        // Cliff vesting
        if (schedule.vestingType == IBaseWill.VestingType.CLIFF) {
            uint256 cliffEnd = vestingStart + schedule.cliffDuration;

            if (currentTime < cliffEnd) {
                return cliffEnd;
            }

            return currentTime; // Available now
        }

        // Milestone - no automatic release
        return 0;
    }

    /**
     * @notice Calculate claimable amount (vested minus already claimed)
     * @param schedule Vesting schedule
     * @param totalAmount Total allocation
     * @param startTime When vesting started
     * @param currentTime Current timestamp
     * @param amountClaimed Already claimed amount
     * @return claimable Amount available to claim now
     */
    function getClaimableAmount(
        IBaseWill.VestingSchedule memory schedule,
        uint256 totalAmount,
        uint256 startTime,
        uint256 currentTime,
        uint256 amountClaimed
    ) internal pure returns (uint256 claimable) {
        uint256 vested = calculateVestedAmount(schedule, totalAmount, startTime, currentTime);

        if (vested <= amountClaimed) {
            return 0;
        }

        return vested - amountClaimed;
    }

    /**
     * @notice Validate vesting schedule parameters
     * @param schedule Vesting schedule to validate
     * @return isValid True if schedule is valid
     * @return reason Error reason if invalid
     */
    function validateSchedule(
        IBaseWill.VestingSchedule memory schedule
    ) internal pure returns (bool isValid, string memory reason) {
        // Immediate vesting doesn't need additional params
        if (schedule.vestingType == IBaseWill.VestingType.IMMEDIATE) {
            return (true, "");
        }

        // Linear vesting needs duration
        if (schedule.vestingType == IBaseWill.VestingType.LINEAR) {
            if (schedule.duration == 0) {
                return (false, "Linear vesting requires duration > 0");
            }
            if (schedule.cliffDuration >= schedule.duration) {
                return (false, "Cliff must be less than total duration");
            }
            if (schedule.releaseInterval > schedule.duration) {
                return (false, "Release interval cannot exceed duration");
            }
            return (true, "");
        }

        // Cliff vesting needs cliff duration
        if (schedule.vestingType == IBaseWill.VestingType.CLIFF) {
            if (schedule.cliffDuration == 0) {
                return (false, "Cliff vesting requires cliffDuration > 0");
            }
            return (true, "");
        }

        // Milestone vesting needs condition hash
        if (schedule.vestingType == IBaseWill.VestingType.MILESTONE) {
            if (schedule.milestoneCondition == bytes32(0)) {
                return (false, "Milestone vesting requires condition hash");
            }
            return (true, "");
        }

        return (false, "Unknown vesting type");
    }

    /**
     * @notice Calculate release count for linear vesting
     * @param schedule Vesting schedule
     * @return totalReleases Number of releases over vesting period
     */
    function getReleaseCount(
        IBaseWill.VestingSchedule memory schedule
    ) internal pure returns (uint256 totalReleases) {
        if (schedule.vestingType != IBaseWill.VestingType.LINEAR) {
            return 1; // Single release for other types
        }

        if (schedule.releaseInterval == 0 || schedule.duration == 0) {
            return 1;
        }

        return schedule.duration / schedule.releaseInterval;
    }

    /**
     * @notice Get current release number (1-indexed)
     * @param schedule Vesting schedule
     * @param startTime When vesting started
     * @param currentTime Current timestamp
     * @return releaseNumber Current release number (0 if none available yet)
     */
    function getCurrentReleaseNumber(
        IBaseWill.VestingSchedule memory schedule,
        uint256 startTime,
        uint256 currentTime
    ) internal pure returns (uint256 releaseNumber) {
        uint256 vestingStart = startTime + schedule.startDelay;

        if (currentTime < vestingStart) {
            return 0;
        }

        if (schedule.vestingType == IBaseWill.VestingType.IMMEDIATE) {
            return 1;
        }

        if (schedule.vestingType == IBaseWill.VestingType.LINEAR) {
            // Check cliff
            if (schedule.cliffDuration > 0 && currentTime < vestingStart + schedule.cliffDuration) {
                return 0;
            }

            uint256 elapsed = currentTime - vestingStart;

            if (schedule.releaseInterval == 0) {
                return elapsed > 0 ? 1 : 0;
            }

            uint256 completedIntervals = elapsed / schedule.releaseInterval;
            uint256 totalIntervals = schedule.duration / schedule.releaseInterval;

            return completedIntervals > totalIntervals ? totalIntervals : completedIntervals;
        }

        if (schedule.vestingType == IBaseWill.VestingType.CLIFF) {
            if (currentTime >= vestingStart + schedule.cliffDuration) {
                return 1;
            }
            return 0;
        }

        return 0;
    }

    /**
     * @notice Create default immediate vesting schedule
     * @return schedule Immediate vesting schedule
     */
    function createImmediateSchedule() internal pure returns (IBaseWill.VestingSchedule memory schedule) {
        return IBaseWill.VestingSchedule({
            vestingType: IBaseWill.VestingType.IMMEDIATE,
            startDelay: 0,
            duration: 0,
            cliffDuration: 0,
            releaseInterval: 0,
            milestoneCondition: bytes32(0)
        });
    }

    /**
     * @notice Create linear vesting schedule
     * @param duration Total vesting duration in seconds
     * @param cliffDuration Cliff period in seconds
     * @param releaseInterval Time between releases in seconds
     * @return schedule Linear vesting schedule
     */
    function createLinearSchedule(
        uint256 duration,
        uint256 cliffDuration,
        uint256 releaseInterval
    ) internal pure returns (IBaseWill.VestingSchedule memory schedule) {
        return IBaseWill.VestingSchedule({
            vestingType: IBaseWill.VestingType.LINEAR,
            startDelay: 0,
            duration: duration,
            cliffDuration: cliffDuration,
            releaseInterval: releaseInterval,
            milestoneCondition: bytes32(0)
        });
    }

    /**
     * @notice Create cliff vesting schedule
     * @param cliffDuration Cliff period in seconds
     * @return schedule Cliff vesting schedule
     */
    function createCliffSchedule(
        uint256 cliffDuration
    ) internal pure returns (IBaseWill.VestingSchedule memory schedule) {
        return IBaseWill.VestingSchedule({
            vestingType: IBaseWill.VestingType.CLIFF,
            startDelay: 0,
            duration: 0,
            cliffDuration: cliffDuration,
            releaseInterval: 0,
            milestoneCondition: bytes32(0)
        });
    }
}
