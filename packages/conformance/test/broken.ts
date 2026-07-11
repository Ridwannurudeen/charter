import { describeCharterModuleConformance } from "../src";

import { deployLeakyFixture } from "./fixtures";

describeCharterModuleConformance("PublicDecryptLeakingProbe", deployLeakyFixture);
