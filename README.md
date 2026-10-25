# WaterPrint Ledger

**A local-first prototype for AI resource awareness and estimated resource-savings attestations.**

WaterPrint provides a browser interface and browser extension that estimate resource use from AI prompt text, offer simple prompt optimization, and prepare data payloads that can be used for later attestation.

The project also includes a deployed Solidity ledger contract on Arc Mainnet.

> **Important:** WaterPrint's current resource values are heuristic estimates, not direct measurements of electricity or water consumption. A locally generated attestation is not automatically submitted to the blockchain, and an on-chain record does not independently prove that claimed savings occurred.

## Current capabilities

- Estimate resource-use indicators from prompt length.
- Offer basic text simplification.
- Generate a SHA-256 hash over a canonical attestation string.
- Display or copy an attestation payload.
- Provide a Solidity contract for recording a hash and caller-supplied estimated energy and water values.

## Browser extension

The extension currently targets ChatGPT and Google Gemini in supported Chromium-based browsers.

### Install

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome or `brave://extensions/` in Brave. For Edge, open `edge://extensions/`.
3. Enable Developer mode.
4. Select **Load unpacked**.
5. Choose the `extension` directory containing `manifest.json`.

The extension is a prototype. Review its permissions and source code before use. Its content script operates on supported AI website pages.

## Web interface

Open `index.html` in a compatible browser to explore the standalone interface. Some browser security features, including Web Crypto, may require a secure context such as localhost or HTTPS.

The current interface prepares a local attestation receipt. It does not connect a wallet or submit a transaction to Arc Mainnet.

## Arc Mainnet deployment

Public deployment information is recorded in [`deployment.json`](deployment.json).

- Network: Arc Mainnet
- Chain ID: `5042`
- Contract: `0xb496DF307d4C524411778e5b975032e3415102ac`
- Deployment transaction: `0xbda93bc7d2cef4853310a90b5a40327058c5f3de676cd8390be745104921081d`
- Deployment block: `27755365`
- Solidity compiler version recorded for the build: `0.8.34`

The contract exposes a permissionless function for recording a unique nonzero hash, the caller address, and caller-supplied resource estimates. The contract labels the accounting type `estimated_avoided`; it does not independently measure or validate physical energy or water savings.

The deployment transaction and contract code were previously checked on-chain. Independent source-to-bytecode verification remains pending. The compiled JSON artifacts currently present in the working tree differ in creation bytecode and should not be treated as interchangeable until reconciled.

## Estimates and limitations

- Estimates are based on simplified prompt-length heuristics.
- Results depend on the assumptions used by the prototype and are not calibrated measurements of model energy or water use.
- A hash provides an integrity reference for the hashed input; it does not establish that the underlying claim is true.
- The contract does not validate the truth of submitted estimates.
- The current app and extension prepare attestations locally; they do not automatically submit them to the deployed contract.
- The project has not been represented here as formally audited or independently verified.

## Privacy

The extension is designed to operate in the browser, but users should review the code and permissions before installation. Do not submit sensitive prompts to any service unless you have independently confirmed how that service handles data.

See [`privacy.html`](privacy.html) for the project's privacy statement. Privacy claims should be checked against the current implementation before relying on them.

## Development status

WaterPrint is an evolving prototype. Contributions, code review, reproducible tests, and independent verification are welcome.

Before using the contract in a production workflow, review the source, deployment details, and security assumptions.

## License

The Solidity source identifies Apache License 2.0. Confirm the repository's complete licensing and attribution requirements before redistribution.
