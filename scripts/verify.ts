import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

/**
 * Contract Verification Script for BaseScan
 *
 * Reads deployment info and verifies contracts on the block explorer.
 */

interface DeploymentInfo {
  network: string;
  contracts: {
    NotaryRegistry: string;
    BaseWill: string;
  };
  config: {
    minimumNotaryStake: string;
    withdrawalCooldown: number;
    commissionWallets: string[];
    platformFeeBps: number;
    notaryRewardBps: number;
    executorRewardBps: number;
  };
}

async function main() {
  console.log("\n========================================");
  console.log("     Contract Verification Script");
  console.log("========================================\n");

  // Load latest deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestPath = path.join(deploymentsDir, `${network.name}-latest.json`);

  if (!fs.existsSync(latestPath)) {
    throw new Error(`No deployment found for network: ${network.name}`);
  }

  const deployment: DeploymentInfo = JSON.parse(
    fs.readFileSync(latestPath, "utf8")
  );

  console.log("Network:", network.name);
  console.log("NotaryRegistry:", deployment.contracts.NotaryRegistry);
  console.log("BaseWill:", deployment.contracts.BaseWill);
  console.log("");

  // Verify NotaryRegistry
  console.log("Verifying NotaryRegistry...");
  try {
    await run("verify:verify", {
      address: deployment.contracts.NotaryRegistry,
      constructorArguments: [
        ethers.parseEther(deployment.config.minimumNotaryStake),
        deployment.config.withdrawalCooldown,
      ],
    });
    console.log("NotaryRegistry verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("NotaryRegistry already verified");
    } else {
      console.error("Failed to verify NotaryRegistry:", error.message);
    }
  }

  // Verify BaseWill
  console.log("\nVerifying BaseWill...");
  try {
    await run("verify:verify", {
      address: deployment.contracts.BaseWill,
      constructorArguments: [
        deployment.contracts.NotaryRegistry,
        deployment.config.commissionWallets,
        deployment.config.platformFeeBps,
        deployment.config.notaryRewardBps,
        deployment.config.executorRewardBps,
      ],
    });
    console.log("BaseWill verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("BaseWill already verified");
    } else {
      console.error("Failed to verify BaseWill:", error.message);
    }
  }

  console.log("\n========================================");
  console.log("       Verification Complete!");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
