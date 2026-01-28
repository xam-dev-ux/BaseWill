import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { NotaryRegistry } from "../typechain-types";

describe("NotaryRegistry", function () {
  // Constants
  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const WITHDRAWAL_COOLDOWN = 7 * 24 * 60 * 60; // 7 days

  // Fixture to deploy contract
  async function deployNotaryRegistryFixture() {
    const [owner, notary1, notary2, notary3, nonNotary, baseWillMock] =
      await ethers.getSigners();

    const NotaryRegistry = await ethers.getContractFactory("NotaryRegistry");
    const notaryRegistry = await NotaryRegistry.deploy(
      MINIMUM_STAKE,
      WITHDRAWAL_COOLDOWN
    );

    // Set mock BaseWill contract
    await notaryRegistry.setBaseWillContract(baseWillMock.address);

    return {
      notaryRegistry,
      owner,
      notary1,
      notary2,
      notary3,
      nonNotary,
      baseWillMock,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct configuration", async function () {
      const { notaryRegistry } = await loadFixture(deployNotaryRegistryFixture);

      expect(await notaryRegistry.minimumStake()).to.equal(MINIMUM_STAKE);
      expect(await notaryRegistry.withdrawalCooldown()).to.equal(WITHDRAWAL_COOLDOWN);
    });

    it("Should set owner correctly", async function () {
      const { notaryRegistry, owner } = await loadFixture(
        deployNotaryRegistryFixture
      );
      expect(await notaryRegistry.owner()).to.equal(owner.address);
    });
  });

  describe("Notary Registration", function () {
    it("Should register a notary with sufficient stake", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await expect(
        notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE })
      )
        .to.emit(notaryRegistry, "NotaryRegistered")
        .withArgs(notary1.address, MINIMUM_STAKE, await time.latest() + 1);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.isRegistered).to.be.true;
      expect(info.stake).to.equal(MINIMUM_STAKE);
      expect(info.reputationScore).to.equal(50); // Initial reputation
    });

    it("Should reject registration with insufficient stake", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      const insufficientStake = ethers.parseEther("0.05");

      await expect(
        notaryRegistry.connect(notary1).registerNotary({ value: insufficientStake })
      ).to.be.revertedWithCustomError(notaryRegistry, "InsufficientStake");
    });

    it("Should reject duplicate registration", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      await expect(
        notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE })
      ).to.be.revertedWithCustomError(notaryRegistry, "NotaryAlreadyRegistered");
    });

    it("Should update notary count", async function () {
      const { notaryRegistry, notary1, notary2 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      expect(await notaryRegistry.getNotaryCount()).to.equal(0);

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });
      expect(await notaryRegistry.getNotaryCount()).to.equal(1);

      await notaryRegistry.connect(notary2).registerNotary({ value: MINIMUM_STAKE });
      expect(await notaryRegistry.getNotaryCount()).to.equal(2);
    });

    it("Should update total stake", async function () {
      const { notaryRegistry, notary1, notary2 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      expect(await notaryRegistry.getTotalStake()).to.equal(0);

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });
      expect(await notaryRegistry.getTotalStake()).to.equal(MINIMUM_STAKE);

      await notaryRegistry.connect(notary2).registerNotary({ value: MINIMUM_STAKE });
      expect(await notaryRegistry.getTotalStake()).to.equal(MINIMUM_STAKE * 2n);
    });
  });

  describe("Stake Management", function () {
    it("Should allow increasing stake", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const additionalStake = ethers.parseEther("0.05");

      await expect(
        notaryRegistry.connect(notary1).increaseStake({ value: additionalStake })
      )
        .to.emit(notaryRegistry, "StakeIncreased")
        .withArgs(notary1.address, additionalStake, MINIMUM_STAKE + additionalStake);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.stake).to.equal(MINIMUM_STAKE + additionalStake);
    });

    it("Should reject stake increase from non-notary", async function () {
      const { notaryRegistry, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await expect(
        notaryRegistry.connect(nonNotary).increaseStake({ value: MINIMUM_STAKE })
      ).to.be.revertedWith("Not a registered notary");
    });
  });

  describe("Withdrawal", function () {
    it("Should request withdrawal", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      // Register with extra stake
      const totalStake = MINIMUM_STAKE + ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).registerNotary({ value: totalStake });

      const withdrawAmount = ethers.parseEther("0.05");

      await expect(
        notaryRegistry.connect(notary1).requestWithdrawal(withdrawAmount)
      )
        .to.emit(notaryRegistry, "WithdrawalRequested");
    });

    it("Should complete withdrawal after cooldown", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      // Register with extra stake
      const totalStake = MINIMUM_STAKE + ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).registerNotary({ value: totalStake });

      const withdrawAmount = ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).requestWithdrawal(withdrawAmount);

      // Fast forward past cooldown
      await time.increase(WITHDRAWAL_COOLDOWN + 1);

      const balanceBefore = await ethers.provider.getBalance(notary1.address);

      await expect(
        notaryRegistry.connect(notary1).completeWithdrawal()
      )
        .to.emit(notaryRegistry, "WithdrawalCompleted")
        .withArgs(notary1.address, withdrawAmount);

      const balanceAfter = await ethers.provider.getBalance(notary1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should reject withdrawal completion before cooldown", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      const totalStake = MINIMUM_STAKE + ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).registerNotary({ value: totalStake });

      const withdrawAmount = ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).requestWithdrawal(withdrawAmount);

      // Try immediately
      await expect(
        notaryRegistry.connect(notary1).completeWithdrawal()
      ).to.be.revertedWithCustomError(notaryRegistry, "CooldownNotComplete");
    });

    it("Should cancel withdrawal request", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      const totalStake = MINIMUM_STAKE + ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).registerNotary({ value: totalStake });

      const withdrawAmount = ethers.parseEther("0.05");
      await notaryRegistry.connect(notary1).requestWithdrawal(withdrawAmount);

      await expect(
        notaryRegistry.connect(notary1).cancelWithdrawal()
      )
        .to.emit(notaryRegistry, "WithdrawalCancelled")
        .withArgs(notary1.address, withdrawAmount);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.pendingWithdrawal).to.equal(0);
    });

    it("Should deregister when withdrawing entire stake", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      // Request full withdrawal
      await notaryRegistry.connect(notary1).requestWithdrawal(MINIMUM_STAKE);

      // Fast forward
      await time.increase(WITHDRAWAL_COOLDOWN + 1);

      await notaryRegistry.connect(notary1).completeWithdrawal();

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.isRegistered).to.be.false;
      expect(info.stake).to.equal(0);

      expect(await notaryRegistry.getNotaryCount()).to.equal(0);
    });
  });

  describe("Slashing", function () {
    it("Should slash notary stake", async function () {
      const { notaryRegistry, notary1, baseWillMock, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const slashAmount = ethers.parseEther("0.05");

      await expect(
        notaryRegistry
          .connect(baseWillMock)
          .slashNotary(
            notary1.address,
            slashAmount,
            "False verification",
            1,
            nonNotary.address
          )
      )
        .to.emit(notaryRegistry, "NotarySlashed")
        .withArgs(notary1.address, slashAmount, "False verification", 1);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.stake).to.equal(MINIMUM_STAKE - slashAmount);
      expect(info.slashedAmount).to.equal(slashAmount);
    });

    it("Should decrease reputation on slash", async function () {
      const { notaryRegistry, notary1, baseWillMock, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const infoBefore = await notaryRegistry.getNotaryInfo(notary1.address);

      await notaryRegistry
        .connect(baseWillMock)
        .slashNotary(
          notary1.address,
          ethers.parseEther("0.01"),
          "False verification",
          1,
          nonNotary.address
        );

      const infoAfter = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(infoAfter.reputationScore).to.be.lt(infoBefore.reputationScore);
    });

    it("Should deregister if slashed below minimum", async function () {
      const { notaryRegistry, notary1, baseWillMock, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      // Slash entire stake
      await notaryRegistry
        .connect(baseWillMock)
        .slashNotary(
          notary1.address,
          MINIMUM_STAKE,
          "Massive fraud",
          1,
          nonNotary.address
        );

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.isRegistered).to.be.false;
    });

    it("Should only allow BaseWill to slash", async function () {
      const { notaryRegistry, notary1, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      await expect(
        notaryRegistry
          .connect(nonNotary)
          .slashNotary(
            notary1.address,
            ethers.parseEther("0.01"),
            "Unauthorized",
            1,
            nonNotary.address
          )
      ).to.be.revertedWith("Only BaseWill contract");
    });
  });

  describe("Verification Recording", function () {
    it("Should record verification", async function () {
      const { notaryRegistry, notary1, baseWillMock } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("death-certificate"));

      await expect(
        notaryRegistry
          .connect(baseWillMock)
          .recordVerification(notary1.address, 1, proofHash)
      )
        .to.emit(notaryRegistry, "VerificationRecorded")
        .withArgs(notary1.address, 1, proofHash);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.totalVerifications).to.equal(1);
    });

    it("Should mark verification as successful", async function () {
      const { notaryRegistry, notary1, baseWillMock } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("death-certificate"));
      await notaryRegistry
        .connect(baseWillMock)
        .recordVerification(notary1.address, 1, proofHash);

      await notaryRegistry
        .connect(baseWillMock)
        .markVerificationSuccessful(notary1.address, 1);

      const info = await notaryRegistry.getNotaryInfo(notary1.address);
      expect(info.successfulVerifications).to.equal(1);
      // Reputation should increase
      expect(info.reputationScore).to.be.gt(50);
    });
  });

  describe("Reward Distribution", function () {
    it("Should distribute reward to notary", async function () {
      const { notaryRegistry, notary1, baseWillMock } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("death-certificate"));
      await notaryRegistry
        .connect(baseWillMock)
        .recordVerification(notary1.address, 1, proofHash);

      const rewardAmount = ethers.parseEther("0.01");
      const balanceBefore = await ethers.provider.getBalance(notary1.address);

      await expect(
        notaryRegistry
          .connect(baseWillMock)
          .distributeReward(notary1.address, 1, { value: rewardAmount })
      )
        .to.emit(notaryRegistry, "RewardDistributed")
        .withArgs(notary1.address, 1, rewardAmount);

      const balanceAfter = await ethers.provider.getBalance(notary1.address);
      expect(balanceAfter).to.equal(balanceBefore + rewardAmount);
    });
  });

  describe("Deregistration", function () {
    it("Should allow voluntary deregistration", async function () {
      const { notaryRegistry, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const balanceBefore = await ethers.provider.getBalance(notary1.address);

      await expect(notaryRegistry.connect(notary1).deregister())
        .to.emit(notaryRegistry, "NotaryRemoved")
        .withArgs(notary1.address, "Voluntary deregistration", MINIMUM_STAKE);

      const balanceAfter = await ethers.provider.getBalance(notary1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      expect(await notaryRegistry.getNotaryCount()).to.equal(0);
    });

    it("Should allow owner to remove notary", async function () {
      const { notaryRegistry, notary1, owner } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      await expect(
        notaryRegistry.connect(owner).removeNotary(notary1.address, "Governance decision")
      )
        .to.emit(notaryRegistry, "NotaryRemoved")
        .withArgs(notary1.address, "Governance decision", MINIMUM_STAKE);
    });
  });

  describe("View Functions", function () {
    it("Should check if notary is active", async function () {
      const { notaryRegistry, notary1, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      expect(await notaryRegistry.isActiveNotary(notary1.address)).to.be.false;

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      expect(await notaryRegistry.isActiveNotary(notary1.address)).to.be.true;
      expect(await notaryRegistry.isActiveNotary(nonNotary.address)).to.be.false;
    });

    it("Should return registered notaries list", async function () {
      const { notaryRegistry, notary1, notary2, notary3 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });
      await notaryRegistry.connect(notary2).registerNotary({ value: MINIMUM_STAKE });
      await notaryRegistry.connect(notary3).registerNotary({ value: MINIMUM_STAKE });

      const notaries = await notaryRegistry.getRegisteredNotaries(0, 10);
      expect(notaries.length).to.equal(3);
      expect(notaries).to.include(notary1.address);
      expect(notaries).to.include(notary2.address);
      expect(notaries).to.include(notary3.address);
    });

    it("Should return verification history", async function () {
      const { notaryRegistry, notary1, baseWillMock } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });

      const proofHash1 = ethers.keccak256(ethers.toUtf8Bytes("proof-1"));
      const proofHash2 = ethers.keccak256(ethers.toUtf8Bytes("proof-2"));

      await notaryRegistry.connect(baseWillMock).recordVerification(notary1.address, 1, proofHash1);
      await notaryRegistry.connect(baseWillMock).recordVerification(notary1.address, 2, proofHash2);

      const history = await notaryRegistry.getVerificationHistory(notary1.address);
      expect(history.length).to.equal(2);
      expect(history[0].proofHash).to.equal(proofHash1);
      expect(history[1].proofHash).to.equal(proofHash2);
    });

    it("Should return top notaries by reputation", async function () {
      const { notaryRegistry, notary1, notary2, notary3, baseWillMock } =
        await loadFixture(deployNotaryRegistryFixture);

      await notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE });
      await notaryRegistry.connect(notary2).registerNotary({ value: MINIMUM_STAKE });
      await notaryRegistry.connect(notary3).registerNotary({ value: MINIMUM_STAKE });

      // Increase notary2's reputation
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
      await notaryRegistry.connect(baseWillMock).recordVerification(notary2.address, 1, proofHash);
      await notaryRegistry.connect(baseWillMock).markVerificationSuccessful(notary2.address, 1);
      await notaryRegistry.connect(baseWillMock).recordVerification(notary2.address, 2, proofHash);
      await notaryRegistry.connect(baseWillMock).markVerificationSuccessful(notary2.address, 2);

      const topNotaries = await notaryRegistry.getTopNotaries(2);
      expect(topNotaries[0]).to.equal(notary2.address); // Highest reputation
    });
  });

  describe("Admin Functions", function () {
    it("Should update minimum stake", async function () {
      const { notaryRegistry, owner } = await loadFixture(
        deployNotaryRegistryFixture
      );

      const newMinimum = ethers.parseEther("0.2");

      await expect(notaryRegistry.connect(owner).setMinimumStake(newMinimum))
        .to.emit(notaryRegistry, "MinimumStakeUpdated")
        .withArgs(MINIMUM_STAKE, newMinimum);

      expect(await notaryRegistry.minimumStake()).to.equal(newMinimum);
    });

    it("Should update withdrawal cooldown", async function () {
      const { notaryRegistry, owner } = await loadFixture(
        deployNotaryRegistryFixture
      );

      const newCooldown = 14 * 24 * 60 * 60; // 14 days

      await expect(notaryRegistry.connect(owner).setWithdrawalCooldown(newCooldown))
        .to.emit(notaryRegistry, "WithdrawalCooldownUpdated")
        .withArgs(WITHDRAWAL_COOLDOWN, newCooldown);

      expect(await notaryRegistry.withdrawalCooldown()).to.equal(newCooldown);
    });

    it("Should reject non-owner admin calls", async function () {
      const { notaryRegistry, nonNotary } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await expect(
        notaryRegistry.connect(nonNotary).setMinimumStake(ethers.parseEther("0.2"))
      ).to.be.revertedWithCustomError(notaryRegistry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pausability", function () {
    it("Should pause registration when paused", async function () {
      const { notaryRegistry, owner, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(owner).pause();

      await expect(
        notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE })
      ).to.be.revertedWithCustomError(notaryRegistry, "EnforcedPause");
    });

    it("Should allow registration after unpause", async function () {
      const { notaryRegistry, owner, notary1 } = await loadFixture(
        deployNotaryRegistryFixture
      );

      await notaryRegistry.connect(owner).pause();
      await notaryRegistry.connect(owner).unpause();

      await expect(
        notaryRegistry.connect(notary1).registerNotary({ value: MINIMUM_STAKE })
      ).to.emit(notaryRegistry, "NotaryRegistered");
    });
  });
});
