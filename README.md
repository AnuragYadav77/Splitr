# Splitr

Splitr is a UPI-inspired smart budgeting prototype designed to help you manage your money with simple envelope-style budgeting. 

## Features
- **Smart Envelopes (Sections):** Allocate your monthly income into distinct sections (like Food, Shopping, Entertainment, Rent).
- **Payment Simulator:** A mock QR-style payment flow that deducts directly from your sections. Includes a 4-digit PIN for realistic friction.
- **Emergency Overrides:** Running out of budget? Use the emergency override to spend beyond a section's limit if absolutely necessary.
- **Savings Jar:** Automatically sweeps any unspent budget into a Savings Jar at the end of every month. Set goals and track your progress visually.
- **Fixed Bills:** Track recurring bills with due dates so you never miss a payment.
- **Month-End Rollover:** A dedicated flow to reset your budgets for the new month and review your spending.

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (ES Modules). No heavy frameworks!
- **Backend:** Node.js, Express.js.
- **Database:** `lowdb` (local JSON file storage for rapid prototyping).

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

*Tip: Use the "Load Demo Account" button during onboarding to instantly populate the app with realistic data for testing!*

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
