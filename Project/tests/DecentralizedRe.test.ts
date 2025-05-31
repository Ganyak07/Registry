import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Error constants matching the contract
const ERR_UNAUTHORIZED = 1;
const ERR_ALREADY_REGISTERED = 2;
const ERR_IDENTITY_NOT_FOUND = 3;
const ERR_IDENTITY_NOT_VERIFIED = 4;
const ERR_NOT_ASSET_OWNER = 6;
const ERR_INSUFFICIENT_REPUTATION = 9;
const ERR_INVALID_CLAIM_TYPE = 10;


Clarinet.test({
    name: "Contract initialization ",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const owner = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "initialize", [
                types.principal(owner.address),
                types.uint(50)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
    }
});

Clarinet.test({
    name: "Non-deployer cannot initialize contract",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const owner = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "initialize", [
                types.principal(owner.address),
                types.uint(50)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, `(err u${ERR_UNAUTHORIZED})`);
    }
});

Clarinet.test({
    name: "Register new identity successfully",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify identity was registered
        let identityDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-details",
            [types.principal(wallet1.address)],
            wallet1.address
        );
        
        assertEquals(identityDetails.result.includes("John Doe"), true);
        assertEquals(identityDetails.result.includes("john@example.com"), true);
        assertEquals(identityDetails.result.includes("verified: false"), true);
    }
});

Clarinet.test({
    name: "Cannot register identity twice",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Jane Doe"),
                types.ascii("jane@example.com")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, `(err u${ERR_ALREADY_REGISTERED})`);
    }
});

Clarinet.test({
    name: "Update identity information",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "update-identity", [
                types.ascii("John Smith"),
                types.ascii("johnsmith@example.com")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        
        // Verify identity was updated
        let identityDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-details",
            [types.principal(wallet1.address)],
            wallet1.address
        );
        
        assertEquals(identityDetails.result.includes("John Smith"), true);
        assertEquals(identityDetails.result.includes("johnsmith@example.com"), true);
    }
});

Clarinet.test({
    name: "Cannot update non-existent identity",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "update-identity", [
                types.ascii("John Smith"),
                types.ascii("johnsmith@example.com")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, `(err u${ERR_IDENTITY_NOT_FOUND})`);
    }
});

Clarinet.test({
    name: "Set and get identity attributes",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "set-identity-attribute", [
                types.ascii("profession"),
                types.ascii("Real Estate Agent")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        
        // Verify attribute was set
        let attribute = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-attribute",
            [types.principal(wallet1.address), types.ascii("profession")],
            wallet1.address
        );
        
        assertEquals(attribute.result.includes("Real Estate Agent"), true);
    }
});

Clarinet.test({
    name: "Remove identity attribute",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "set-identity-attribute", [
                types.ascii("profession"),
                types.ascii("Real Estate Agent")
            ], wallet1.address),
            Tx.contractCall("property-registry", "remove-identity-attribute", [
                types.ascii("profession")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        assertEquals(block.receipts[2].result, "(ok true)");
        
        // Verify attribute was removed
        let attribute = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-attribute",
            [types.principal(wallet1.address), types.ascii("profession")],
            wallet1.address
        );
        
        assertEquals(attribute.result, "none");
    }
});

Clarinet.test({
    name: "Contract owner can verify identity",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        
        // Verify identity is now verified
        let identityDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-details",
            [types.principal(wallet1.address)],
            wallet1.address
        );
        
        assertEquals(identityDetails.result.includes("verified: true"), true);
    }
});

Clarinet.test({
    name: "Non-owner cannot verify identity",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, `(err u${ERR_UNAUTHORIZED})`);
    }
});

Clarinet.test({
    name: "Update reputation score",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "update-reputation", [
                types.principal(wallet1.address),
                types.uint(75)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        
        // Verify reputation was updated
        let identityDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-identity-details",
            [types.principal(wallet1.address)],
            wallet1.address
        );
        
        assertEquals(identityDetails.result.includes("reputation-score: u75"), true);
    }
});

Clarinet.test({
    name: "Register asset by verified identity",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa with ocean view"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach", "bedrooms": 3}')
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, "(ok true)");
        assertEquals(block.receipts[2].result, "(ok u0)"); // Asset ID 0
        
        // Verify asset was registered
        let assetDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-asset-details",
            [types.uint(0)],
            wallet1.address
        );
        
        assertEquals(assetDetails.result.includes("Luxury Villa"), true);
        assertEquals(assetDetails.result.includes("Beautiful 3-bedroom villa"), true);
    }
});

Clarinet.test({
    name: "Unverified identity cannot register asset",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa with ocean view"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach"}')
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, "(ok true)");
        assertEquals(block.receipts[1].result, `(err u${ERR_IDENTITY_NOT_VERIFIED})`);
    }
});

Clarinet.test({
    name: "Update asset details by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach"}')
            ], wallet1.address),
            Tx.contractCall("property-registry", "update-asset-details", [
                types.uint(0),
                types.ascii("Updated Luxury Villa"),
                types.ascii("Updated: Beautiful 4-bedroom villa"),
                types.ascii('{"location": "Miami Beach", "bedrooms": 4}')
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[3].result, "(ok true)");
        
        // Verify asset was updated
        let assetDetails = chain.callReadOnlyFn(
            "property-registry",
            "get-asset-details",
            [types.uint(0)],
            wallet1.address
        );
        
        assertEquals(assetDetails.result.includes("Updated Luxury Villa"), true);
        assertEquals(assetDetails.result.includes("Updated: Beautiful 4-bedroom"), true);
    }
});

Clarinet.test({
    name: "Non-owner cannot update asset details",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach"}')
            ], wallet1.address),
            Tx.contractCall("property-registry", "update-asset-details", [
                types.uint(0),
                types.ascii("Updated Villa"),
                types.ascii("Updated description"),
                types.ascii('{"updated": true}')
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[3].result, `(err u${ERR_NOT_ASSET_OWNER})`);
    }
});

Clarinet.test({
    name: "Transfer asset ownership",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            // Register both identities
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Jane Smith"),
                types.ascii("jane@example.com")
            ], wallet2.address),
            // Verify both identities
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet2.address)
            ], deployer.address),
            // Register asset
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach"}')
            ], wallet1.address),
            // Transfer asset
            Tx.contractCall("property-registry", "transfer-asset", [
                types.uint(0),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 6);
        assertEquals(block.receipts[5].result, "(ok true)");
        
        // Verify ownership changed
        let owner = chain.callReadOnlyFn(
            "property-registry",
            "get-asset-owner",
            [types.uint(0)],
            wallet1.address
        );
        
        assertEquals(owner.result, `(ok ${wallet2.address})`);
    }
});

Clarinet.test({
    name: "Cannot transfer to unverified identity",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("John Doe"),
                types.ascii("john@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Jane Smith"),
                types.ascii("jane@example.com")
            ], wallet2.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Luxury Villa"),
                types.ascii("Beautiful 3-bedroom villa"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"location": "Miami Beach"}')
            ], wallet1.address),
            Tx.contractCall("property-registry", "transfer-asset", [
                types.uint(0),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[4].result, `(err u${ERR_IDENTITY_NOT_VERIFIED})`);
    }
});

Clarinet.test({
    name: "Make attestation with sufficient reputation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            // Register identities
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Asset Owner"),
                types.ascii("owner@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Inspector"),
                types.ascii("inspector@example.com")
            ], wallet2.address),
            // Verify identities
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet2.address)
            ], deployer.address),
            // Set reputation for attester
            Tx.contractCall("property-registry", "update-reputation", [
                types.principal(wallet2.address),
                types.uint(75)
            ], deployer.address),
            // Register asset
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Test Property"),
                types.ascii("Property for testing"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"test": true}')
            ], wallet1.address),
            // Make attestation
            Tx.contractCall("property-registry", "make-attestation", [
                types.uint(0),
                types.ascii("CONDITION"),
                types.ascii("Excellent condition, recently renovated")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 7);
        assertEquals(block.receipts[6].result, "(ok true)");
        
        // Verify attestation exists
        let attestation = chain.callReadOnlyFn(
            "property-registry",
            "get-attestation",
            [types.principal(wallet2.address), types.uint(0), types.ascii("CONDITION")],
            wallet2.address
        );
        
        assertEquals(attestation.result.includes("Excellent condition"), true);
    }
});

Clarinet.test({
    name: "Cannot make attestation with insufficient reputation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Asset Owner"),
                types.ascii("owner@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Inspector"),
                types.ascii("inspector@example.com")
            ], wallet2.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet2.address)
            ], deployer.address),
            // Set low reputation (below minimum of 50)
            Tx.contractCall("property-registry", "update-reputation", [
                types.principal(wallet2.address),
                types.uint(25)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Test Property"),
                types.ascii("Property for testing"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"test": true}')
            ], wallet1.address),
            Tx.contractCall("property-registry", "make-attestation", [
                types.uint(0),
                types.ascii("CONDITION"),
                types.ascii("Good condition")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 7);
        assertEquals(block.receipts[6].result, `(err u${ERR_INSUFFICIENT_REPUTATION})`);
    }
});

Clarinet.test({
    name: "Cannot make attestation with invalid claim type",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Asset Owner"),
                types.ascii("owner@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Inspector"),
                types.ascii("inspector@example.com")
            ], wallet2.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet2.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "update-reputation", [
                types.principal(wallet2.address),
                types.uint(75)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Test Property"),
                types.ascii("Property for testing"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"test": true}')
            ], wallet1.address),
            Tx.contractCall("property-registry", "make-attestation", [
                types.uint(0),
                types.ascii("INVALID_TYPE"),
                types.ascii("Some claim")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 7);
        assertEquals(block.receipts[6].result, `(err u${ERR_INVALID_CLAIM_TYPE})`);
    }
});

Clarinet.test({
    name: "Update and revoke attestation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            // Setup identities and asset
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Asset Owner"),
                types.ascii("owner@example.com")
            ], wallet1.address),
            Tx.contractCall("property-registry", "register-identity", [
                types.ascii("Inspector"),
                types.ascii("inspector@example.com")
            ], wallet2.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet1.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "verify-identity", [
                types.principal(wallet2.address)
            ], deployer.address),
            Tx.contractCall("property-registry", "update-reputation", [
                types.principal(wallet2.address),
                types.uint(75)
            ], deployer.address),
            Tx.contractCall("property-registry", "register-asset", [
                types.ascii("Test Property"),
                types.ascii("Property for testing"),
                types.ascii("RESIDENTIAL"),
                types.ascii('{"test": true}')
            ], wallet1.address),
            // Make attestation
            Tx.contractCall("property-registry", "make-attestation", [
                types.uint(0),
                types.ascii("CONDITION"),
                types.ascii("Good condition")
            ], wallet2.address),
            // Update attestation
            Tx.contractCall("property-registry", "update-attestation", [
                types.uint(0),
                types.ascii("CONDITION"),
                types.ascii("Excellent condition after inspection")
            ], wallet2.address),
            // Revoke attestation
            Tx.contractCall("property-registry", "revoke-attestation", [
                types.uint(0),
                types.ascii("CONDITION")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 9);
        assertEquals(block.receipts[6].result, "(ok true)"); // make attestation
        assertEquals(block.receipts[7].result, "(ok true)"); // update attestation
        assertEquals(block.receipts[8].result, "(ok true)"); // revoke attestation
        
        // Verify attestation is not valid (revoked)
        let isValid = chain.callReadOnlyFn(
            "property-registry",
            "is-attestation-valid",
            [types.principal(wallet2.address), types.uint(0), types.ascii("CONDITION")],
            wallet2.address
        );
        
        assertEquals(isValid.result, "false");
    }
});

