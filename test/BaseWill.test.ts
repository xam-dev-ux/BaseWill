import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BaseWill, NotaryRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BaseWill", function () {
  // Constants
  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const WITHDRAWAL_COOLDOWN = 7 * 24 * 60 * 60; // 7 days
  const PLATFORM_FEE_BPS = 100; // 1%
  const NOTARY_REWARD_BPS = 50; // 0.5%
  const EXECUTOR_REWARD_BPS = 10; // 0.1%

  const ONE_YEAR = 365 * 24 * 60 * 60;
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  const NINETY_DAYS = 90 * 24 * 60 * 60;

  // Fixture to deploy contracts
  async function deployBaseWillFixture() {
    const [owner, testator, beneficiary1, beneficiary2, notary1, notary2, notary3, executor] =
      await ethers.getSigners();

    // Deploy NotaryRegistry
    const NotaryRegistry = await ethers.getContractFactory("NotaryRegistry");
    const notaryRegistry = await NotaryRegistry.deploy(
      MINIMUM_STAKE,
      WITHDRAWAL_COOLDOWN
    );

    // Deploy BaseWill
    const BaseWill = await ethers.getContractFactory("BaseWill");
    const baseWill = await BaseWill.deploy(
      await notaryRegistry.getAddress(),
      [owner.address], // Commission wallets
      PLATFORM_FEE_BPS,
      NOTARY_REWARD_BPS,
      EXECUTOR_REWARD_BPS
    );

    // Configure NotaryRegistry with BaseWill
    await notaryRegistry.setBaseWillContract(await baseWill.getAddress());

    // Register notaries
    await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });
    await notaryRegistry.connect(notary2).registerNotary({ value: MINIMUM_STAKE });
    await notaryRegistry.connect(notary3).registerNotary({ value: MINIMUM_STAKE });

    return {
      baseWill,
      notaryRegistry,
      owner,
      testator,
      beneficiary1,
      beneficiary2,
      notary1,
      notary2,
      notary3,
      executor,
    };
  }

  // Helper to create a will
  async function createTestWill(
    baseWill: BaseWill,
    testator: HardhatEthersSigner,
    activationMode: number = 0 // TIME_BASED
  ) {
    const tx = await baseWill.connect(testator).createWill(
      activationMode, // ActivationMode.TIME_BASED
      ONE_YEAR, // 1 year inactivity threshold
      THIRTY_DAYS, // 30 days grace period
      NINETY_DAYS, // 90 days dispute period
      ethers.keccak256(ethers.toUtf8Bytes("test-metadata")),
      ethers.ZeroAddress // No backup executor
    );

    const receipt = await tx.wait();
    // Get will ID from event
    const event = receipt?.logs.find(
      (log: any) => log.fragment?.name === "WillCreated"
    );
    return event ? (event as any).args[0] : 1n;
  }

  describe("Deployment", function () {
    it("Should deploy with correct configuration", async function () {
      const { baseWill, notaryRegistry, owner } = await loadFixture(
        deployBaseWillFixture
      );

      expect(await baseWill.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await baseWill.notaryRewardBps()).to.equal(NOTARY_REWARD_BPS);
      expect(await baseWill.executorRewardBps()).to.equal(EXECUTOR_REWARD_BPS);
      expect(await baseWill.notaryRegistry()).to.equal(
        await notaryRegistry.getAddress()
      );
    });

    it("Should set owner correctly", async function () {
      const { baseWill, owner } = await loadFixture(deployBaseWillFixture);
      expect(await baseWill.owner()).to.equal(owner.address);
    });
  });

  describe("Will Creation", function () {
    it("Should create a will successfully", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      const willId = await createTestWill(baseWill, testator);

      const will = await baseWill.getWill(willId);
      expect(will.testator).to.equal(testator.address);
      expect(will.status).to.equal(0); // DRAFT
      expect(will.inactivityThreshold).to.equal(ONE_YEAR);
    });

    it("Should track testator's wills", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      await createTestWill(baseWill, testator);
      await createTestWill(baseWill, testator);

      const willIds = await baseWill.getTestatorWills(testator.address);
      expect(willIds.length).to.equal(2);
    });

    it("Should reject invalid inactivity threshold", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      // Too short (less than 90 days)
      await expect(
        baseWill.connect(testator).createWill(
          0,
          60 * 24 * 60 * 60, // 60 days
          THIRTY_DAYS,
          NINETY_DAYS,
          ethers.keccak256(ethers.toUtf8Bytes("test")),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Inactivity threshold too short");
    });

    it("Should emit WillCreated event", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      await expect(
        baseWill.connect(testator).createWill(
          0,
          ONE_YEAR,
          THIRTY_DAYS,
          NINETY_DAYS,
          ethers.keccak256(ethers.toUtf8Bytes("test")),
          ethers.ZeroAddress
        )
      )
        .to.emit(baseWill, "WillCreated")
        .withArgs(1, testator.address, 0, ONE_YEAR, 0);
    });
  });

  describe("Beneficiary Management", function () {
    it("Should add beneficiary", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0, // IMMEDIATE
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await expect(
        baseWill
          .connect(testator)
          .addBeneficiary(
            willId,
            beneficiary1.address,
            5000, // 50%
            vestingSchedule,
            true, // isPrimary
            ethers.keccak256(ethers.toUtf8Bytes("Wife"))
          )
      )
        .to.emit(baseWill, "BeneficiaryAdded")
        .withArgs(willId, beneficiary1.address, 5000);
    });

    it("Should prevent adding duplicate beneficiary", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 5000, vestingSchedule, true, ethers.ZeroHash);

      await expect(
        baseWill
          .connect(testator)
          .addBeneficiary(willId, beneficiary1.address, 3000, vestingSchedule, true, ethers.ZeroHash)
      ).to.be.revertedWith("Beneficiary already exists");
    });

    it("Should remove beneficiary", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 5000, vestingSchedule, true, ethers.ZeroHash);

      await expect(
        baseWill.connect(testator).removeBeneficiary(willId, beneficiary1.address)
      )
        .to.emit(baseWill, "BeneficiaryRemoved")
        .withArgs(willId, beneficiary1.address);
    });

    it("Should track beneficiary's wills", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      const willIds = await baseWill.getBeneficiaryWills(beneficiary1.address);
      expect(willIds.length).to.equal(1);
      expect(willIds[0]).to.equal(willId);
    });
  });

  describe("Will Activation", function () {
    it("Should activate a will with valid beneficiaries", async function () {
      const { baseWill, testator, beneficiary1, beneficiary2 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 6000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary2.address, 4000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(1); // ACTIVE
    });

    it("Should reject activation without beneficiaries", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      const willId = await createTestWill(baseWill, testator);

      await expect(
        baseWill.connect(testator).activateWill(willId)
      ).to.be.revertedWith("No beneficiaries");
    });
  });

  describe("Check-In (Activity)", function () {
    it("Should record check-in activity", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward 100 days
      await time.increase(100 * 24 * 60 * 60);

      await expect(baseWill.connect(testator).checkIn(willId))
        .to.emit(baseWill, "ActivityRecorded")
        .withArgs(willId, 0, await time.latest() + 1); // MANUAL_CHECK_IN
    });

    it("Should update lastActivity on check-in", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      const willBefore = await baseWill.getWill(willId);
      const lastActivityBefore = willBefore.lastActivity;

      // Fast forward
      await time.increase(100 * 24 * 60 * 60);

      await baseWill.connect(testator).checkIn(willId);

      const willAfter = await baseWill.getWill(willId);
      expect(willAfter.lastActivity).to.be.gt(lastActivityBefore);
    });
  });

  describe("ETH Deposit", function () {
    it("Should accept ETH deposits", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const [ethBalance] = await baseWill.getWillValue(willId);
      expect(ethBalance).to.equal(depositAmount);
    });

    it("Should update totalValueSecured on deposit", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      const totalBefore = await baseWill.totalValueSecured();

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const totalAfter = await baseWill.totalValueSecured();
      expect(totalAfter).to.equal(totalBefore + depositAmount);
    });
  });

  describe("Will Triggering", function () {
    it("Should trigger will after inactivity threshold", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward past inactivity threshold (1 year + 1 day)
      await time.increase(ONE_YEAR + 24 * 60 * 60);

      await expect(baseWill.connect(executor).triggerWill(willId))
        .to.emit(baseWill, "WillTriggered");

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(2); // TRIGGERED
    });

    it("Should not trigger will before inactivity threshold", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward only 6 months
      await time.increase(180 * 24 * 60 * 60);

      await expect(
        baseWill.connect(executor).triggerWill(willId)
      ).to.be.revertedWith("Trigger conditions not met");
    });
  });

  describe("Grace Period", function () {
    it("Should allow testator to cancel trigger during grace period", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward past inactivity threshold
      await time.increase(ONE_YEAR + 24 * 60 * 60);

      // Trigger the will
      await baseWill.connect(executor).triggerWill(willId);

      // Fast forward 10 days (still in grace period)
      await time.increase(10 * 24 * 60 * 60);

      // Testator cancels
      await expect(baseWill.connect(testator).cancelTrigger(willId))
        .to.emit(baseWill, "GracePeriodCancelled")
        .withArgs(willId, testator.address);

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(1); // Back to ACTIVE
    });

    it("Should check in cancel trigger during grace period", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward past inactivity threshold
      await time.increase(ONE_YEAR + 24 * 60 * 60);

      // Trigger the will
      await baseWill.connect(executor).triggerWill(willId);

      // Testator checks in
      await baseWill.connect(testator).checkIn(willId);

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(1); // Back to ACTIVE
    });
  });

  describe("Will Execution", function () {
    it("Should execute will after grace period", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      // Deposit ETH
      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward past inactivity threshold
      await time.increase(ONE_YEAR + 24 * 60 * 60);

      // Trigger
      await baseWill.connect(executor).triggerWill(willId);

      // Fast forward past grace period
      await time.increase(THIRTY_DAYS + 24 * 60 * 60);

      // Execute
      await expect(baseWill.connect(executor).executeWill(willId))
        .to.emit(baseWill, "WillExecutionStarted");

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(4); // EXECUTED
    });

    it("Should distribute assets to beneficiaries", async function () {
      const { baseWill, testator, beneficiary1, beneficiary2, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("10.0");

      // Deposit ETH
      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      // 60% to beneficiary1, 40% to beneficiary2
      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 6000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary2.address, 4000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      const b1BalanceBefore = await ethers.provider.getBalance(beneficiary1.address);
      const b2BalanceBefore = await ethers.provider.getBalance(beneficiary2.address);

      // Fast forward and trigger
      await time.increase(ONE_YEAR + 24 * 60 * 60);
      await baseWill.connect(executor).triggerWill(willId);
      await time.increase(THIRTY_DAYS + 24 * 60 * 60);

      // Execute
      await baseWill.connect(executor).executeWill(willId);

      const b1BalanceAfter = await ethers.provider.getBalance(beneficiary1.address);
      const b2BalanceAfter = await ethers.provider.getBalance(beneficiary2.address);

      // Beneficiaries should have received funds (minus fees)
      expect(b1BalanceAfter).to.be.gt(b1BalanceBefore);
      expect(b2BalanceAfter).to.be.gt(b2BalanceBefore);
    });

    it("Should not execute during grace period", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Fast forward past inactivity threshold
      await time.increase(ONE_YEAR + 24 * 60 * 60);

      // Trigger
      await baseWill.connect(executor).triggerWill(willId);

      // Try to execute immediately (still in grace period)
      await expect(
        baseWill.connect(executor).executeWill(willId)
      ).to.be.revertedWith("Grace period not ended");
    });
  });

  describe("Emergency Withdrawal", function () {
    it("Should initiate emergency withdrawal", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      await expect(baseWill.connect(testator).initiateEmergencyWithdrawal(willId))
        .to.emit(baseWill, "EmergencyWithdrawalInitiated");
    });

    it("Should complete emergency withdrawal after cooldown", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Initiate
      await baseWill.connect(testator).initiateEmergencyWithdrawal(willId);

      // Fast forward past cooldown
      await time.increase(THIRTY_DAYS + 24 * 60 * 60);

      const balanceBefore = await ethers.provider.getBalance(testator.address);

      // Complete
      await baseWill.connect(testator).completeEmergencyWithdrawal(willId);

      const balanceAfter = await ethers.provider.getBalance(testator.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(5); // CANCELLED
    });
  });

  describe("Will Cancellation", function () {
    it("Should cancel a will", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      const willId = await createTestWill(baseWill, testator);

      await expect(baseWill.connect(testator).cancelWill(willId, "Changed my mind"))
        .to.emit(baseWill, "WillCancelled")
        .withArgs(willId, testator.address, "Changed my mind");

      const will = await baseWill.getWill(willId);
      expect(will.status).to.equal(5); // CANCELLED
    });

    it("Should return deposited ETH on cancellation", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const balanceBefore = await ethers.provider.getBalance(testator.address);

      await baseWill.connect(testator).cancelWill(willId, "Cancelling");

      const balanceAfter = await ethers.provider.getBalance(testator.address);
      // Should have received back the deposit (minus gas)
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("View Functions", function () {
    it("Should return platform stats", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("1.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      const stats = await baseWill.getPlatformStats();

      expect(stats.totalValueSecured).to.equal(depositAmount);
      expect(stats.totalWillsCreated).to.equal(1);
      expect(stats.activeWills).to.equal(1);
    });

    it("Should estimate distribution correctly", async function () {
      const { baseWill, testator, beneficiary1, beneficiary2 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);
      const depositAmount = ethers.parseEther("10.0");

      await baseWill.connect(testator).depositETH(willId, { value: depositAmount });

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 6000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary2.address, 4000, vestingSchedule, true, ethers.ZeroHash);

      const [addresses, amounts, platformFee, notaryRewards, executorReward] =
        await baseWill.estimateDistribution(willId);

      expect(addresses.length).to.equal(2);
      expect(platformFee).to.be.gt(0);

      // Platform fee should be 1% of 10 ETH = 0.1 ETH
      expect(platformFee).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("Access Control", function () {
    it("Should only allow testator to modify will", async function () {
      const { baseWill, testator, beneficiary1 } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      // Beneficiary tries to add another beneficiary
      await expect(
        baseWill
          .connect(beneficiary1)
          .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash)
      ).to.be.revertedWith("Not testator");
    });

    it("Should only allow owner to update configuration", async function () {
      const { baseWill, testator } = await loadFixture(deployBaseWillFixture);

      await expect(
        baseWill.connect(testator).updateConfiguration(50, 3, THIRTY_DAYS)
      ).to.be.revertedWithCustomError(baseWill, "OwnableUnauthorizedAccount");
    });
  });

  describe("Delegated Check-In", function () {
    it("Should allow delegated check-in", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Add delegate
      await baseWill.connect(testator).addDelegatedCheckIn(willId, executor.address);

      // Fast forward
      await time.increase(100 * 24 * 60 * 60);

      // Delegate checks in
      await expect(baseWill.connect(executor).delegatedCheckIn(willId))
        .to.emit(baseWill, "ActivityRecorded")
        .withArgs(willId, 4, await time.latest() + 1); // DELEGATED_CHECK_IN
    });

    it("Should reject unauthorized delegated check-in", async function () {
      const { baseWill, testator, beneficiary1, executor } = await loadFixture(
        deployBaseWillFixture
      );

      const willId = await createTestWill(baseWill, testator);

      const vestingSchedule = {
        vestingType: 0,
        startDelay: 0,
        duration: 0,
        cliffDuration: 0,
        releaseInterval: 0,
        milestoneCondition: ethers.ZeroHash,
      };

      await baseWill
        .connect(testator)
        .addBeneficiary(willId, beneficiary1.address, 10000, vestingSchedule, true, ethers.ZeroHash);

      await baseWill.connect(testator).activateWill(willId);

      // Not added as delegate
      await expect(
        baseWill.connect(executor).delegatedCheckIn(willId)
      ).to.be.revertedWith("Not authorized for delegated check-in");
    });
  });
});
