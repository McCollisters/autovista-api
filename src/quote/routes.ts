import { Router } from "express";
import { createQuote } from "./controllers/createQuote";
import { getQuote } from "./controllers/getQuote";
import { updateQuote } from "./controllers/updateQuote";
import { validateQuoteBody } from "./middleware/validateQuoteBody";
import { deleteQuote } from "./controllers/deleteQuote";
import { updateTransportOptions } from "./controllers/updateTransportOptions";
import { findQuoteCustomer } from "./controllers/findQuoteCustomer";
import { createQuoteCustomer } from "./controllers/createQuoteCustomer";
import { updateQuoteAlternative } from "./controllers/updateQuoteAlternative";

const router = Router();

// Specific routes first (before parameterized routes)
router.post("/transport", updateTransportOptions);
router.post("/customer/find", findQuoteCustomer);
router.post("/customer", createQuoteCustomer);
router.put("/", updateQuoteAlternative);

// General routes
router.post("/", validateQuoteBody, createQuote);

// Parameterized routes
router.get("/:quoteId", getQuote);
router.patch("/:quoteId", updateQuote);
router.delete("/:quoteId", deleteQuote);

export default router;
