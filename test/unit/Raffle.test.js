const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval
          const chainId = network.config.chainId
          let deployer, accounts

          beforeEach(async function () {
              accounts = await getNamedAccounts()
              deployer = accounts.deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("contructor", function () {
              it("initialized the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
              })
          })
          describe("enter raffle", function () {
              it("revert when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playFromContract = await raffle.getPlayer(0)
                  assert.equal(playFromContract, deployer)
              })
              it("emit an event when player enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
                      .to.emit(raffle, "RaffleEnter")
                      .withArgs(deployer)
              })
              it("doesnt allow entrance when calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  //pretend to be chainlink keep
                  await raffle.performUpkeep([])
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpened"
                  )
              })
          })

          describe("checkUpkeep", function () {
              it("should return false when no players added", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("should return false when time has not passed", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("should return false when isOpen is not true", async function () {
                  raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  //pretend to be chainlink keep
                  await raffle.performUpkeep([])
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("should return true when has players and time passed and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe("performUpkeep", function () {
              it("should revert with Raffle__UpkeepNotNeeded when upkeep not needed", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("should set raffleState to be CALCULATING and emit RequestedRaffleWinner", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await expect(raffle.performUpkeep([])).to.emit(raffle, "RequestedRaffleWinner")
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "1")
              })
          })
      })
