import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { deployCharterRegistry } from "../src";

describe("deployCharterRegistry", function () {
  before(function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  it("deploys a usable registry with documented defaults", async function () {
    const [deployer] = await ethers.getSigners();
    const registry = await deployCharterRegistry(deployer);

    expect(await registry.name()).to.equal("Charter Registry");
    expect(await registry.symbol()).to.equal("CHTR");
    expect(await registry.isAdmin(deployer.address)).to.equal(true);
    expect(await registry.isAgent(deployer.address)).to.equal(true);
  });

  it("does not configure an agent when a different admin is supplied", async function () {
    const [deployer, admin] = await ethers.getSigners();
    const registry = await deployCharterRegistry(deployer, {
      name: "Example Holdings",
      symbol: "EXH",
      admin: admin.address,
      initialAgent: false,
    });

    expect(await registry.name()).to.equal("Example Holdings");
    expect(await registry.symbol()).to.equal("EXH");
    expect(await registry.isAdmin(admin.address)).to.equal(true);
    expect(await registry.isAgent(admin.address)).to.equal(false);
  });
});
