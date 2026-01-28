import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * BaseWill Deployment Script
 *
 * Deploys:
 * 1. NotaryRegistry - Notary staking and management
 * 2. BaseWill - Main will management contract
 *
 * Configuration is loaded from environment variables.
 */

interface DeploymentConfig {
  // NotaryRegistry config
  minimumNotaryStake: bigint;
  withdrawalCooldown: number;

  // BaseWill config
  commissionWallets: string[];
  platformFeeBps: number;
  notaryRewardBps: number;
  executorRewardBps: number;
}

function getConfig(): DeploymentConfig {
  // Parse commission wallets
  const commissionWalletsEnv = process.env.COMMISSION_WALLETS || "";
  const commissionWallets = commissionWalletsEnv
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (commissionWallets.length === 0) {
    throw new Error("COMMISSION_WALLETS environment variable must be set");
  }

  return {
    // Default: 0.1 ETH minimum stake
    minimumNotaryStake: ethers.parseEther(
      process.env.MINIMUM_NOTARY_STAKE || "0.1"
    ),
    // Default: 7 days cooldown
    withdrawalCooldown: parseInt(
      process.env.WITHDRAWAL_COOLDOWN || String(7 * 24 * 60 * 60)
    ),
    commissionWallets,
    // Default: 1% platform fee
    platformFeeBps: parseInt(process.env.PLATFORM_FEE_BPS || "100"),
    // Default: 0.5% notary reward
    notaryRewardBps: parseInt(process.env.NOTARY_REWARD_BPS || "50"),
    // Default: 0.1% executor reward
    executorRewardBps: parseInt(process.env.EXECUTOR_REWARD_BPS || "10"),
  };
}

async function main() {
  console.log("\n========================================");
  console.log("       BaseWill Deployment Script");
  console.log("========================================\n");

  const signers = await ethers.getSigners();

  if (signers.length === 0) {
    console.error("ERROR: No signer available!");
    console.error("\nTo deploy, you need to:");
    console.error("1. Set PRIVATE_KEY in your .env file with a valid 64-character hex key");
    console.error("   Example: PRIVATE_KEY=0x1234...abcd (66 chars total including 0x)");
    console.error("2. Ensure the wallet has ETH for gas fees");
    console.error("\nFor testnet deployment, you can get free ETH from:");
    console.error("   https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    process.exit(1);
  }

  const [deployer] = signers;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  const config = getConfig();

  console.log("Configuration:");
  console.log("- Minimum Notary Stake:", ethers.formatEther(config.minimumNotaryStake), "ETH");
  console.log("- Withdrawal Cooldown:", config.withdrawalCooldown / 86400, "days");
  console.log("- Commission Wallets:", config.commissionWallets.length);
  console.log("- Platform Fee:", config.platformFeeBps / 100, "%");
  console.log("- Notary Reward:", config.notaryRewardBps / 100, "%");
  console.log("- Executor Reward:", config.executorRewardBps / 100, "%");
  console.log("");

  // Deploy NotaryRegistry
  console.log("Deploying NotaryRegistry...");
  const NotaryRegistry = await ethers.getContractFactory("NotaryRegistry");
  const notaryRegistry = await NotaryRegistry.deploy(
    config.minimumNotaryStake,
    config.withdrawalCooldown
  );
  await notaryRegistry.waitForDeployment();
  const notaryRegistryAddress = await notaryRegistry.getAddress();
  console.log("NotaryRegistry deployed to:", notaryRegistryAddress);

  // Deploy BaseWillCore (slimmer version that fits within contract size limit)
  console.log("\nDeploying BaseWillCore...");
  const BaseWillCore = await ethers.getContractFactory("BaseWillCore");
  const baseWill = await BaseWillCore.deploy(config.commissionWallets);
  await baseWill.waitForDeployment();
  const baseWillAddress = await baseWill.getAddress();
  console.log("BaseWillCore deployed to:", baseWillAddress);

  // Configure NotaryRegistry with BaseWill address
  console.log("\nConfiguring NotaryRegistry...");
  const setBaseWillTx = await notaryRegistry.setBaseWillContract(baseWillAddress);
  await setBaseWillTx.wait();
  console.log("NotaryRegistry configured with BaseWill address");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      NotaryRegistry: notaryRegistryAddress,
      BaseWill: baseWillAddress,
    },
    config: {
      minimumNotaryStake: ethers.formatEther(config.minimumNotaryStake),
      withdrawalCooldown: config.withdrawalCooldown,
      commissionWallets: config.commissionWallets,
      platformFeeBps: config.platformFeeBps,
      notaryRewardBps: config.notaryRewardBps,
      executorRewardBps: config.executorRewardBps,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(
    deploymentsDir,
    `${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Also save latest deployment for easy access
  const latestPath = path.join(deploymentsDir, `${network.name}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Latest deployment saved to:", latestPath);

  console.log("\n========================================");
  console.log("         Deployment Complete!");
  console.log("========================================");
  console.log("\nContract Addresses:");
  console.log("- NotaryRegistry:", notaryRegistryAddress);
  console.log("- BaseWill:", baseWillAddress);
  console.log("\nNext steps:");
  console.log("1. Verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network ${network.name} ${notaryRegistryAddress} ${config.minimumNotaryStake} ${config.withdrawalCooldown}`);
  console.log(`   npx hardhat verify --network ${network.name} ${baseWillAddress} ${notaryRegistryAddress} "[${config.commissionWallets.map(w => `"${w}"`).join(",")}]" ${config.platformFeeBps} ${config.notaryRewardBps} ${config.executorRewardBps}`);
  console.log("2. Update frontend with contract addresses");
  console.log("3. Register initial notaries if needed");
  console.log("");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
