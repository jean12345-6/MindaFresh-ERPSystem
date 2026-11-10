// accounting/routes/index.js — every page of the Accounting & Finance module (port 3005)
import express from "express";
import { requireRole } from "../middleware/requireRole.js";
import { loginPage, loginUser, logoutUser } from "../controllers/authController.js";
import { home, dashboardPage } from "../controllers/dashboardController.js";
import { pendingPage, postNew } from "../controllers/postingController.js";
import { journalList, entryPage, newEntryPage, createManual, voidEntry } from "../controllers/journalController.js";
import { accountsPage, createAccount, toggleAccount } from "../controllers/accountController.js";
import { releasesPage, release } from "../controllers/payrollController.js";
import { remittancesPage, suggest, create as createRemittance, pay as payRemittance } from "../controllers/remittanceController.js";
import { reportsIndex, trialBalancePage, incomeStatementPage, balanceSheetPage, ledgerPage, salesSummaryPage } from "../controllers/reportController.js";

const router = express.Router();
const ACC = requireRole("accountant", "admin");                 // full access (blueprint Section 6)
const VIEW_RELEASES = requireRole("accountant", "admin", "hr_staff"); // HR can see salary release status

router.get("/", home);
router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/logout", logoutUser);

router.get("/dashboard", ACC, dashboardPage);

router.get("/post", ACC, pendingPage);
router.post("/post", ACC, postNew);

router.get("/journal", ACC, journalList);
router.get("/journal/new", ACC, newEntryPage);
router.post("/journal", ACC, createManual);
router.get("/journal/:code", ACC, entryPage);
router.post("/journal/:code/void", ACC, voidEntry);

router.get("/accounts", ACC, accountsPage);
router.post("/accounts", ACC, createAccount);
router.post("/accounts/:id/toggle", ACC, toggleAccount);

router.get("/salary-releases", VIEW_RELEASES, releasesPage);
router.post("/salary-releases/:id/release", ACC, release);

router.get("/remittances", ACC, remittancesPage);
router.get("/remittances/suggest", ACC, suggest);
router.post("/remittances", ACC, createRemittance);
router.post("/remittances/:id/pay", ACC, payRemittance);

router.get("/reports", ACC, reportsIndex);
router.get("/reports/trial-balance", ACC, trialBalancePage);
router.get("/reports/income-statement", ACC, incomeStatementPage);
router.get("/reports/balance-sheet", ACC, balanceSheetPage);
router.get("/reports/ledger", ACC, ledgerPage);
router.get("/reports/sales-summary", ACC, salesSummaryPage);

export default router;
