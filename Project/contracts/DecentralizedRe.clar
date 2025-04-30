;; Decentralized Property Registry
;; A smart contract for registering and managing assets with verifiable claims
;; Designed for the Stacks blockchain

;; Error codes
(define-constant ERR-UNAUTHORIZED u1)
(define-constant ERR-ALREADY-REGISTERED u2)
(define-constant ERR-IDENTITY-NOT-FOUND u3)
(define-constant ERR-IDENTITY-NOT-VERIFIED u4)
(define-constant ERR-ASSET-NOT-FOUND u5)
(define-constant ERR-NOT-ASSET-OWNER u6)
(define-constant ERR-INVALID-INPUT u7)
(define-constant ERR-ATTESTATION-NOT-FOUND u8)
(define-constant ERR-INSUFFICIENT-REPUTATION u9)
(define-constant ERR-INVALID-CLAIM-TYPE u10)
(define-constant ERR-ATTESTATION-ALREADY-REVOKED u11)

;; ========== Contract Variables ==========

;; Variable to store the contract owner
(define-data-var contract-owner principal tx-sender)

;; Counter for asset IDs
(define-data-var asset-counter uint u0)

;; Minimum reputation score required for making attestations
(define-data-var min-attestation-reputation uint u50)

;; List of attestation types allowed in the system
(define-data-var allowed-claim-types (list 20 (string-ascii 50)) (list 
  "CONDITION" 
  "VALUATION" 
  "INSPECTION" 
  "PROVENANCE" 
  "AUTHENTICITY"
  "APPRAISAL"
  "MAINTENANCE"
  "CERTIFICATION"
  "LEGAL_STATUS"
  "ENCUMBRANCE"
))

;; ========== Data Maps ==========

;; Maps to store identity information
(define-map identities principal 
  { 
    name: (string-ascii 100), 
    email: (string-ascii 100), 
    verified: bool, 
    registration-height: uint,
    reputation-score: uint
  }
)

;; Map to store identity attributes
(define-map identity-attributes { principal: principal, attribute-name: (string-ascii 50) } 
  { 
    attribute-value: (string-ascii 500) 
  }
)

;; Map to store asset information
(define-map assets uint 
  { 
    title: (string-ascii 100), 
    description: (string-ascii 500), 
    asset-type: (string-ascii 50), 
    owner: principal, 
    registration-height: uint,
    last-update-height: uint,
    metadata: (string-ascii 1000)
  }
)

;; Map to store asset ownership history
(define-map asset-ownership-history { asset-id: uint, index: uint } 
  { 
    owner: principal, 
    from-height: uint,
    to-height: uint
  }
)

;; Map to track ownership history indexes for each asset
(define-map asset-history-counters uint uint)

;; Map to store attestations about assets
(define-map attestations { attester: principal, asset-id: uint, claim-type: (string-ascii 50) } 
  { 
    claim-value: (string-ascii 500), 
    attestation-height: uint,
    revoked: bool,
    revocation-height: uint
  }
)

;; ========== Private Access Control Functions ==========

;; Check if a principal is the contract owner
(define-private (is-contract-owner (caller principal)) 
  (is-eq caller (var-get contract-owner))
)

;; Check if a principal is a registered identity
(define-private (is-registered-identity (caller principal)) 
  (is-some (map-get? identities caller))
)

;; Check if a principal is a verified identity
(define-private (is-verified-identity (caller principal)) 
  (match (map-get? identities caller)
    identity (get verified identity)
    false
  )
)

;; Check if a principal owns a specific asset
(define-private (is-asset-owner (caller principal) (asset-id uint)) 
  (match (map-get? assets asset-id)
    asset (is-eq caller (get owner asset))
    false
  )
)

;; Check if a claim type is in the allowed list
(define-private (is-valid-claim-type (claim-type (string-ascii 50)))
  (is-some (index-of (var-get allowed-claim-types) claim-type))
)

;; ========== Private Helper Functions ==========

;; Get the current asset counter and increment it
(define-private (get-and-increment-asset-counter)
  (let ((current-counter (var-get asset-counter)))
    (var-set asset-counter (+ current-counter u1))
    current-counter
  )
)

;; Get the current history counter for an asset and increment it
(define-private (get-and-increment-history-counter (asset-id uint))
  (let 
    (
      (current-counter (default-to u0 (map-get? asset-history-counters asset-id)))
      (new-counter (+ u1 (default-to u0 (map-get? asset-history-counters asset-id))))
    )
    (map-set asset-history-counters asset-id new-counter)
    current-counter
  )
)

;; Add an entry to the asset ownership history
(define-private (add-to-ownership-history (asset-id uint) (owner principal) (from-height uint))
  (let 
    (
      (index (get-and-increment-history-counter asset-id))
    )
    (map-set asset-ownership-history { asset-id: asset-id, index: index } 
      { 
        owner: owner, 
        from-height: from-height,
        to-height: u0
      }
    )
    ;; If there's a previous owner, update their to-height
    (and (> index u0)
      (match (map-get? asset-ownership-history { asset-id: asset-id, index: (- index u1) })
        prev-entry 
        (map-set asset-ownership-history 
          { asset-id: asset-id, index: (- index u1) }
          (merge prev-entry { to-height: from-height })
        )
        false
      )
    )
    (ok true)
  )
)

;; ========== Identity Management Functions ==========

;; Register a new identity with basic information
(define-public (register-identity (name (string-ascii 100)) (email (string-ascii 100)))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if identity already exists
    (asserts! (is-none (map-get? identities caller)) (err ERR-ALREADY-REGISTERED))
    
    ;; Register identity
    (map-set identities caller 
      { 
        name: name, 
        email: email, 
        verified: false, 
        registration-height: block-height,
        reputation-score: u0
      }
    )
    (ok true)
  )
)

;; Update existing identity information
(define-public (update-identity (name (string-ascii 100)) (email (string-ascii 100)))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if identity exists
    (asserts! (is-registered-identity caller) (err ERR-IDENTITY-NOT-FOUND))
    
    ;; Get current identity
    (match (map-get? identities caller)
      current-identity 
      (begin
        ;; Update identity
        (map-set identities caller 
          (merge current-identity { name: name, email: email })
        )
        (ok true)
      )
      (err ERR-IDENTITY-NOT-FOUND)
    )
  )
)

;; Add or update an identity attribute
(define-public (set-identity-attribute (attribute-name (string-ascii 50)) (attribute-value (string-ascii 500)))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if identity exists
    (asserts! (is-registered-identity caller) (err ERR-IDENTITY-NOT-FOUND))
    
    ;; Set attribute
    (map-set identity-attributes 
      { principal: caller, attribute-name: attribute-name } 
      { attribute-value: attribute-value }
    )
    (ok true)
  )
)

;; Remove an identity attribute
(define-public (remove-identity-attribute (attribute-name (string-ascii 50)))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if identity exists
    (asserts! (is-registered-identity caller) (err ERR-IDENTITY-NOT-FOUND))
    
    ;; Check if attribute exists
    (asserts! (is-some (map-get? identity-attributes { principal: caller, attribute-name: attribute-name })) (err ERR-INVALID-INPUT))
    
    ;; Remove attribute
    (map-delete identity-attributes { principal: caller, attribute-name: attribute-name })
    (ok true)
  )
)

;; Verify a registered identity (contract owner only)
(define-public (verify-identity (identity principal))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if caller is contract owner
    (asserts! (is-contract-owner caller) (err ERR-UNAUTHORIZED))
    
    ;; Check if identity exists
    (asserts! (is-registered-identity identity) (err ERR-IDENTITY-NOT-FOUND))
    
    ;; Get current identity
    (match (map-get? identities identity)
      current-identity 
      (begin
        ;; Update identity
        (map-set identities identity 
          (merge current-identity { verified: true })
        )
        (ok true)
      )
      (err ERR-IDENTITY-NOT-FOUND)
    )
  )
)

;; Update the reputation score of an identity (contract owner only)
(define-public (update-reputation (identity principal) (new-score uint))
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if caller is contract owner
    (asserts! (is-contract-owner caller) (err ERR-UNAUTHORIZED))
    
    ;; Check if identity exists
    (asserts! (is-registered-identity identity) (err ERR-IDENTITY-NOT-FOUND))
    
    ;; Get current identity
    (match (map-get? identities identity)
      current-identity 
      (begin
        ;; Update identity
        (map-set identities identity 
          (merge current-identity { reputation-score: new-score })
        )
        (ok true)
      )
      (err ERR-IDENTITY-NOT-FOUND)
    )
  )
)

;; ========== Asset Management Functions ==========

;; Register a new asset (verified identities only)
(define-public (register-asset 
  (title (string-ascii 100)) 
  (description (string-ascii 500)) 
  (asset-type (string-ascii 50))
  (metadata (string-ascii 1000))
)
  (let 
    (
      (caller tx-sender)
      (asset-id (get-and-increment-asset-counter))
      (current-height block-height)
    )
    ;; Check if caller is a verified identity
    (asserts! (is-verified-identity caller) (err ERR-IDENTITY-NOT-VERIFIED))
    
    ;; Register asset
    (map-set assets asset-id 
      { 
        title: title, 
        description: description, 
        asset-type: asset-type, 
        owner: caller, 
        registration-height: current-height,
        last-update-height: current-height,
        metadata: metadata
      }
    )
    
    ;; Initialize history counter
    (map-set asset-history-counters asset-id u0)
    
    ;; Add first ownership record
    (add-to-ownership-history asset-id caller current-height)
    
    (ok asset-id)
  )
)

;; Update asset information (asset owner only)
(define-public (update-asset-details 
  (asset-id uint) 
  (title (string-ascii 100)) 
  (description (string-ascii 500)) 
  (metadata (string-ascii 1000))
)
  (let 
    (
      (caller tx-sender)
    )
    ;; Check if asset exists
    (asserts! (is-some (map-get? assets asset-id)) (err ERR-ASSET-NOT-FOUND))
    
    ;; Check if caller is asset owner
    (asserts! (is-asset-owner caller asset-id) (err ERR-NOT-ASSET-OWNER))
    
    ;; Get current asset data
    (match (map-get? assets asset-id)
      current-asset 
      (begin
        ;; Update asset
        (map-set assets asset-id 
          (merge current-asset 
            { 
              title: title, 
              description: description, 
              last-update-height: block-height,
              metadata: metadata
            }
          )
        )
        (ok true)
      )
      (err ERR-ASSET-NOT-FOUND)
    )
  )
)

;; Transfer asset ownership (asset owner only)
(define-public (transfer-asset (asset-id uint) (new-owner principal))
  (let 
    (
      (caller tx-sender)
      (current-height block-height)
    )
    ;; Check if asset exists
    (asserts! (is-some (map-get? assets asset-id)) (err ERR-ASSET-NOT-FOUND))
    
    ;; Check if caller is asset owner
    (asserts! (is-asset-owner caller asset-id) (err ERR-NOT-ASSET-OWNER))
    
    ;; Check if new owner is a verified identity
    (asserts! (is-verified-identity new-owner) (err ERR-IDENTITY-NOT-VERIFIED))
    
    ;; Get current asset data
    (match (map-get? assets asset-id)
      current-asset 
      (begin
        ;; Update asset owner
        (map-set assets asset-id 
          (merge current-asset 
            { 
              owner: new-owner,
              last-update-height: current-height
            }
          )
        )
        
        ;; Add to ownership history
        (add-to-ownership-history asset-id new-owner current-height)
        
        (ok true)
      )
      (err ERR-ASSET-NOT-FOUND)
    )
  )
)

;; ========== Attestation Management Functions ==========

;; Make an attestation about an asset (verified identities only)
(define-public (make-attestation 
  (asset-id uint) 
  (claim-type (string-ascii 50)) 
  (claim-value (string-ascii 500))
)
  (let 
    (
      (caller tx-sender)
      (current-height block-height)
    )
    ;; Check if caller is a verified identity
    (asserts! (is-verified-identity caller) (err ERR-IDENTITY-NOT-VERIFIED))
    
    ;; Check if asset exists
    (asserts! (is-some (map-get? assets asset-id)) (err ERR-ASSET-NOT-FOUND))
    
    ;; Check if claim type is valid
    (asserts! (is-valid-claim-type claim-type) (err ERR-INVALID-CLAIM-TYPE))
    
    ;; Check if attester has sufficient reputation
    (match (map-get? identities caller)
      identity (asserts! (>= (get reputation-score identity) (var-get min-attestation-reputation)) (err ERR-INSUFFICIENT-REPUTATION))
      (err ERR-IDENTITY-NOT-FOUND)
    )
    
    ;; Create attestation
    (map-set attestations 
      { attester: caller, asset-id: asset-id, claim-type: claim-type } 
      { 
        claim-value: claim-value, 
        attestation-height: current-height,
        revoked: false,
        revocation-height: u0
      }
    )
    
    (ok true)
  )
)

;; Revoke an attestation (attester only)
(define-public (revoke-attestation (asset-id uint) (claim-type (string-ascii 50)))
  (let 
    (
      (caller tx-sender)
      (attestation-key { attester: caller, asset-id: asset-id, claim-type: claim-type })
    )
    ;; Check if attestation exists
    (asserts! (is-some (map-get? attestations attestation-key)) (err ERR-ATTESTATION-NOT-FOUND))
    
    ;; Get current attestation
    (match (map-get? attestations attestation-key)
      current-attestation 
      (begin
        ;; Check if attestation is already revoked
        (asserts! (not (get revoked current-attestation)) (err ERR-ATTESTATION-ALREADY-REVOKED))
        
        ;; Update attestation
        (map-set attestations attestation-key 
          (merge current-attestation 
            { 
              revoked: true,
              revocation-height: block-height
            }
          )
        )
        (ok true)
      )
      (err ERR-ATTESTATION-NOT-FOUND)
    )
  )
)

;; Update an attestation (attester only)
(define-public (update-attestation 
  (asset-id uint) 
  (claim-type (string-ascii 50)) 
  (claim-value (string-ascii 500))
)
  (let 
    (
      (caller tx-sender)
      (attestation-key { attester: caller, asset-id: asset-id, claim-type: claim-type })
    )
    ;; Check if attestation exists
    (asserts! (is-some (map-get? attestations attestation-key)) (err ERR-ATTESTATION-NOT-FOUND))
    
    ;; Get current attestation
    (match (map-get? attestations attestation-key)
      current-attestation 
      (begin
        ;; Check if attestation is revoked
        (asserts! (not (get revoked current-attestation)) (err ERR-ATTESTATION-ALREADY-REVOKED))
        
        ;; Update attestation
        (map-set attestations attestation-key 
          (merge current-attestation 
            { 
              claim-value: claim-value,
              attestation-height: block-height
            }
          )
        )
        (ok true)
      )
      (err ERR-ATTESTATION-NOT-FOUND)
    )
  )
)

;; ========== Read-Only Functions ==========

;; Get identity information
(define-read-only (get-identity-details (identity principal))
  (map-get? identities identity)
)

;; Get a specific identity attribute
(define-read-only (get-identity-attribute (identity principal) (attribute-name (string-ascii 50)))
  (map-get? identity-attributes { principal: identity, attribute-name: attribute-name })
)

;; Check if an identity is verified
(define-read-only (is-identity-verified (identity principal))
  (default-to false (get verified (map-get? identities identity)))
)

;; Get the reputation score of an identity
(define-read-only (get-reputation-score (identity principal))
  (default-to u0 (get reputation-score (map-get? identities identity)))
)

;; Get asset information
(define-read-only (get-asset-details (asset-id uint))
  (map-get? assets asset-id)
)

;; Get the current owner of an asset
(define-read-only (get-asset-owner (asset-id uint))
  (get owner (map-get? assets asset-id))
)

;; Get a single entry from the ownership history
(define-read-only (get-ownership-history-entry (asset-id uint) (history-index uint))
  (map-get? asset-ownership-history { asset-id: asset-id, index: history-index })
)

;; Get the number of ownership history entries for an asset
(define-read-only (get-ownership-history-length (asset-id uint))
  (default-to u0 (map-get? asset-history-counters asset-id))
)

;; Get a specific attestation
(define-read-only (get-attestation (attester principal) (asset-id uint) (claim-type (string-ascii 50)))
  (map-get? attestations { attester: attester, asset-id: asset-id, claim-type: claim-type })
)

;; Check if an attestation is valid
(define-read-only (is-attestation-valid (attester principal) (asset-id uint) (claim-type (string-ascii 50)))
  (match (map-get? attestations { attester: attester, asset-id: asset-id, claim-type: claim-type })
    attestation (not (get revoked attestation))
    false
  )
)

;; Get the list of allowed claim types
(define-read-only (get-allowed-claim-types)
  (var-get allowed-claim-types)
)

;; ========== Contract Initialization ==========

;; Initialize the contract
(define-public (initialize (owner principal) (min-reputation uint))
  (let 
    (
      (caller tx-sender)
    )
    ;; Only the contract deployer can initialize
    (asserts! (is-eq caller (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    
    ;; Set contract owner
    (var-set contract-owner owner)
    
    ;; Set minimum reputation for attestations
    (var-set min-attestation-reputation min-reputation)
    
    (ok true)
  )
)