// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IBaseWill.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title AssetLib
 * @author BaseWill Team
 * @notice Library for multi-asset handling
 * @dev Supports ETH, ERC20, ERC721, and ERC1155 transfers
 */
library AssetLib {
    using SafeERC20 for IERC20;

    // ============ Events ============

    event AssetTransferred(
        IBaseWill.AssetType assetType,
        address indexed from,
        address indexed to,
        address contractAddress,
        uint256 tokenId,
        uint256 amount
    );

    event AssetTransferFailed(
        IBaseWill.AssetType assetType,
        address indexed to,
        address contractAddress,
        uint256 tokenId,
        uint256 amount,
        string reason
    );

    // ============ Errors ============

    error TransferFailed(address to, uint256 amount);
    error InsufficientBalance(uint256 required, uint256 available);
    error InvalidAssetType();
    error TokenNotApproved(address token, address owner);
    error NFTNotOwned(address token, uint256 tokenId, address expectedOwner);

    // ============ ETH Transfer Functions ============

    /**
     * @notice Transfer ETH to recipient
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return success True if transfer succeeded
     */
    function transferETH(
        address to,
        uint256 amount
    ) internal returns (bool success) {
        if (amount == 0) {
            return true;
        }

        (success, ) = payable(to).call{value: amount}("");

        if (!success) {
            revert TransferFailed(to, amount);
        }

        return success;
    }

    /**
     * @notice Transfer ETH with fallback handling
     * @dev Uses call instead of transfer for gas flexibility
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return success True if transfer succeeded
     * @return returnData Return data from call
     */
    function safeTransferETH(
        address to,
        uint256 amount
    ) internal returns (bool success, bytes memory returnData) {
        if (amount == 0) {
            return (true, "");
        }

        (success, returnData) = payable(to).call{value: amount, gas: 50000}("");

        return (success, returnData);
    }

    // ============ ERC20 Transfer Functions ============

    /**
     * @notice Transfer ERC20 tokens
     * @param token Token contract address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transferERC20(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        IERC20(token).safeTransferFrom(from, to, amount);
    }

    /**
     * @notice Transfer ERC20 tokens from contract balance
     * @param token Token contract address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transferERC20FromContract(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Check ERC20 allowance
     * @param token Token contract address
     * @param owner Token owner
     * @param spender Spender address
     * @return allowance Current allowance
     */
    function checkERC20Allowance(
        address token,
        address owner,
        address spender
    ) internal view returns (uint256 allowance) {
        return IERC20(token).allowance(owner, spender);
    }

    /**
     * @notice Get ERC20 balance
     * @param token Token contract address
     * @param account Account to check
     * @return balance Token balance
     */
    function getERC20Balance(
        address token,
        address account
    ) internal view returns (uint256 balance) {
        return IERC20(token).balanceOf(account);
    }

    // ============ ERC721 Transfer Functions ============

    /**
     * @notice Transfer ERC721 NFT
     * @param token NFT contract address
     * @param from Current owner
     * @param to Recipient address
     * @param tokenId Token ID to transfer
     */
    function transferERC721(
        address token,
        address from,
        address to,
        uint256 tokenId
    ) internal {
        IERC721(token).safeTransferFrom(from, to, tokenId);
    }

    /**
     * @notice Check ERC721 ownership
     * @param token NFT contract address
     * @param tokenId Token ID
     * @param expectedOwner Expected owner address
     * @return isOwner True if expectedOwner owns the token
     */
    function checkERC721Ownership(
        address token,
        uint256 tokenId,
        address expectedOwner
    ) internal view returns (bool isOwner) {
        try IERC721(token).ownerOf(tokenId) returns (address owner) {
            return owner == expectedOwner;
        } catch {
            return false;
        }
    }

    /**
     * @notice Check if contract is approved for ERC721
     * @param token NFT contract address
     * @param owner Token owner
     * @param operator Operator to check
     * @return isApproved True if approved for all or specific token
     */
    function checkERC721Approval(
        address token,
        address owner,
        address operator
    ) internal view returns (bool isApproved) {
        return IERC721(token).isApprovedForAll(owner, operator);
    }

    // ============ ERC1155 Transfer Functions ============

    /**
     * @notice Transfer ERC1155 tokens
     * @param token Token contract address
     * @param from Current owner
     * @param to Recipient address
     * @param tokenId Token ID
     * @param amount Amount to transfer
     */
    function transferERC1155(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal {
        IERC1155(token).safeTransferFrom(from, to, tokenId, amount, "");
    }

    /**
     * @notice Batch transfer ERC1155 tokens
     * @param token Token contract address
     * @param from Current owner
     * @param to Recipient address
     * @param tokenIds Array of token IDs
     * @param amounts Array of amounts
     */
    function batchTransferERC1155(
        address token,
        address from,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) internal {
        IERC1155(token).safeBatchTransferFrom(from, to, tokenIds, amounts, "");
    }

    /**
     * @notice Get ERC1155 balance
     * @param token Token contract address
     * @param account Account to check
     * @param tokenId Token ID
     * @return balance Token balance
     */
    function getERC1155Balance(
        address token,
        address account,
        uint256 tokenId
    ) internal view returns (uint256 balance) {
        return IERC1155(token).balanceOf(account, tokenId);
    }

    /**
     * @notice Check ERC1155 approval
     * @param token Token contract address
     * @param owner Token owner
     * @param operator Operator to check
     * @return isApproved True if approved
     */
    function checkERC1155Approval(
        address token,
        address owner,
        address operator
    ) internal view returns (bool isApproved) {
        return IERC1155(token).isApprovedForAll(owner, operator);
    }

    // ============ Generic Asset Functions ============

    /**
     * @notice Transfer any asset type
     * @param asset Asset to transfer
     * @param from Source address (owner for approval-based)
     * @param to Destination address
     * @param useContractBalance If true, transfer from contract balance
     * @return success True if transfer succeeded
     */
    function transferAsset(
        IBaseWill.Asset memory asset,
        address from,
        address to,
        bool useContractBalance
    ) internal returns (bool success) {
        if (asset.assetType == IBaseWill.AssetType.ETH) {
            return transferETH(to, asset.amount);
        }

        if (asset.assetType == IBaseWill.AssetType.ERC20) {
            if (useContractBalance) {
                transferERC20FromContract(asset.contractAddress, to, asset.amount);
            } else {
                transferERC20(asset.contractAddress, from, to, asset.amount);
            }
            return true;
        }

        if (asset.assetType == IBaseWill.AssetType.ERC721) {
            address currentOwner = useContractBalance ? address(this) : from;
            transferERC721(asset.contractAddress, currentOwner, to, asset.tokenId);
            return true;
        }

        if (asset.assetType == IBaseWill.AssetType.ERC1155) {
            address currentOwner = useContractBalance ? address(this) : from;
            transferERC1155(asset.contractAddress, currentOwner, to, asset.tokenId, asset.amount);
            return true;
        }

        revert InvalidAssetType();
    }

    /**
     * @notice Check if asset transfer is possible
     * @param asset Asset to check
     * @param owner Asset owner
     * @param spender Spender (contract that will transfer)
     * @param useContractBalance If checking contract balance
     * @return canTransfer True if transfer is possible
     * @return reason Reason if cannot transfer
     */
    function canTransferAsset(
        IBaseWill.Asset memory asset,
        address owner,
        address spender,
        bool useContractBalance
    ) internal view returns (bool canTransfer, string memory reason) {
        if (asset.assetType == IBaseWill.AssetType.ETH) {
            uint256 balance = useContractBalance ? address(spender).balance : owner.balance;
            if (balance < asset.amount) {
                return (false, "Insufficient ETH balance");
            }
            return (true, "");
        }

        if (asset.assetType == IBaseWill.AssetType.ERC20) {
            address balanceHolder = useContractBalance ? spender : owner;
            uint256 balance = getERC20Balance(asset.contractAddress, balanceHolder);

            if (balance < asset.amount) {
                return (false, "Insufficient token balance");
            }

            if (!useContractBalance) {
                uint256 allowance = checkERC20Allowance(asset.contractAddress, owner, spender);
                if (allowance < asset.amount) {
                    return (false, "Insufficient token allowance");
                }
            }

            return (true, "");
        }

        if (asset.assetType == IBaseWill.AssetType.ERC721) {
            address expectedOwner = useContractBalance ? spender : owner;

            if (!checkERC721Ownership(asset.contractAddress, asset.tokenId, expectedOwner)) {
                return (false, "NFT not owned");
            }

            if (!useContractBalance && !checkERC721Approval(asset.contractAddress, owner, spender)) {
                return (false, "NFT not approved");
            }

            return (true, "");
        }

        if (asset.assetType == IBaseWill.AssetType.ERC1155) {
            address balanceHolder = useContractBalance ? spender : owner;
            uint256 balance = getERC1155Balance(asset.contractAddress, balanceHolder, asset.tokenId);

            if (balance < asset.amount) {
                return (false, "Insufficient ERC1155 balance");
            }

            if (!useContractBalance && !checkERC1155Approval(asset.contractAddress, owner, spender)) {
                return (false, "ERC1155 not approved");
            }

            return (true, "");
        }

        return (false, "Invalid asset type");
    }

    /**
     * @notice Calculate total ETH value of assets (simplified)
     * @param assets Array of assets
     * @param ethHeld ETH balance held
     * @return totalValue Total value in wei (only counts ETH directly)
     */
    function calculateTotalETHValue(
        IBaseWill.Asset[] memory assets,
        uint256 ethHeld
    ) internal pure returns (uint256 totalValue) {
        totalValue = ethHeld;

        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].assetType == IBaseWill.AssetType.ETH && assets[i].isIncluded) {
                totalValue += assets[i].amount;
            }
        }

        return totalValue;
    }

    /**
     * @notice Create ETH asset struct
     * @param amount ETH amount
     * @return asset Asset struct for ETH
     */
    function createETHAsset(uint256 amount) internal pure returns (IBaseWill.Asset memory asset) {
        return IBaseWill.Asset({
            assetType: IBaseWill.AssetType.ETH,
            contractAddress: address(0),
            tokenId: 0,
            amount: amount,
            isIncluded: true
        });
    }

    /**
     * @notice Create ERC20 asset struct
     * @param tokenAddress Token contract address
     * @param amount Token amount
     * @return asset Asset struct for ERC20
     */
    function createERC20Asset(
        address tokenAddress,
        uint256 amount
    ) internal pure returns (IBaseWill.Asset memory asset) {
        return IBaseWill.Asset({
            assetType: IBaseWill.AssetType.ERC20,
            contractAddress: tokenAddress,
            tokenId: 0,
            amount: amount,
            isIncluded: true
        });
    }

    /**
     * @notice Create ERC721 asset struct
     * @param tokenAddress NFT contract address
     * @param tokenId Token ID
     * @return asset Asset struct for ERC721
     */
    function createERC721Asset(
        address tokenAddress,
        uint256 tokenId
    ) internal pure returns (IBaseWill.Asset memory asset) {
        return IBaseWill.Asset({
            assetType: IBaseWill.AssetType.ERC721,
            contractAddress: tokenAddress,
            tokenId: tokenId,
            amount: 1,
            isIncluded: true
        });
    }

    /**
     * @notice Create ERC1155 asset struct
     * @param tokenAddress Token contract address
     * @param tokenId Token ID
     * @param amount Amount
     * @return asset Asset struct for ERC1155
     */
    function createERC1155Asset(
        address tokenAddress,
        uint256 tokenId,
        uint256 amount
    ) internal pure returns (IBaseWill.Asset memory asset) {
        return IBaseWill.Asset({
            assetType: IBaseWill.AssetType.ERC1155,
            contractAddress: tokenAddress,
            tokenId: tokenId,
            amount: amount,
            isIncluded: true
        });
    }

    /**
     * @notice Find asset in array
     * @param assets Array of assets
     * @param assetType Asset type to find
     * @param contractAddress Contract address (address(0) for ETH)
     * @param tokenId Token ID (0 for fungibles)
     * @return found True if asset exists
     * @return index Index in array
     */
    function findAsset(
        IBaseWill.Asset[] memory assets,
        IBaseWill.AssetType assetType,
        address contractAddress,
        uint256 tokenId
    ) internal pure returns (bool found, uint256 index) {
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].assetType == assetType &&
                assets[i].contractAddress == contractAddress &&
                assets[i].tokenId == tokenId) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /**
     * @notice Count active (included) assets
     * @param assets Array of assets
     * @return count Number of included assets
     */
    function countActiveAssets(
        IBaseWill.Asset[] memory assets
    ) internal pure returns (uint256 count) {
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].isIncluded) {
                count++;
            }
        }
        return count;
    }
}
