import { describeCharterModuleConformance } from "../src";

import { deployHonestFixture } from "./fixtures";

describeCharterModuleConformance("HonestBalanceAccessProbe", deployHonestFixture);
