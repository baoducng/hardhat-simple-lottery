const { ethers, network, getNamedAccounts } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESS_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/ABI.json"
async function updateAbi(raffle) {
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses(raffle) {
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address)
        }
    } else {
        currentAddresses[chainId] = [raffle.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddresses))
}

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        const deployer = (await getNamedAccounts()).deployer
        const raffle = await ethers.getContract("Raffle")
        updateContractAddresses(raffle)
        updateAbi(raffle)
    }
}

module.exports.tags = ["all", "frontend"]
