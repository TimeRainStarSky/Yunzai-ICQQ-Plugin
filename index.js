logger.info(logger.yellow("- 正在加载 ICQQ 插件"))

import { config, configSave } from "./Model/config.js"
import { createClient } from "icqq"

function makeMessage(data) {
  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.message_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function makeNotice(data) {
  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.notice_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function makeRequest(data) {
  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.request_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

async function connectBot(token) {
  token = token.split(":")
  const id = Number(token[1])
  const bot = createClient({
    ...config.bot,
    platform: token[0],
    data_dir: `${process.cwd()}/data/icqq/${id}`,
  })
  bot.logger = {
    trace: log => logger.trace(`${logger.blue(`[${id}]`)} ${log}`),
    debug: log => logger.debug(`${logger.blue(`[${id}]`)} ${log}`),
    info: log => logger.info(`${logger.blue(`[${id}]`)} ${log}`),
    mark: log => logger.mark(`${logger.blue(`[${id}]`)} ${log}`),
    warn: log => {
      logger.warn(`${logger.blue(`[${id}]`)} ${log}`)
      Bot.sendMasterMsg(`[${id}] ${log}`)
    },
    error: log => {
      logger.error(`${logger.blue(`[${id}]`)} ${log}`)
      Bot.sendMasterMsg(`[${id}] ${log}`)
    },
    fatal: log => {
      logger.fatal(`${logger.blue(`[${id}]`)} ${log}`)
      Bot.sendMasterMsg(`[${id}] ${log}`)
    },
  }

  bot.on("system.login.qrcode", async data => {
    Bot.sendMasterMsg([`[${id}] 扫码完成后，回复 任意消息 继续登录`, segment.image(data.image)])
    await Bot.getMasterMsg()
    bot.qrcodeLogin()
  })

  bot.on("system.login.slider", async data => {
    Bot.sendMasterMsg(`[${id}] 滑动验证完成后，回复 ticket 继续登录\n${data.url}`)
    bot.submitSlider(await Bot.getMasterMsg())
  })

  bot.on("system.login.device", async data => {
    Bot.sendMasterMsg(`[${id}] 请选择设备锁验证方式\n短信验证：回复 短信 继续登录\n扫码验证：扫码完成后，回复 任意消息 继续登录\n${data.url}`)
    const msg = await Bot.getMasterMsg()
    if (msg == "短信") {
      bot.sendSmsCode()
      Bot.sendMasterMsg(`[${id}] 短信已发送，回复 验证码 继续登录`)
      bot.submitSmsCode(await Bot.getMasterMsg())
    } else {
      bot.login()
    }
  })

  bot.login(id, token[2])
  await new Promise(resolve => bot.once("system.online", () => resolve()))
  bot.logger = {
    trace: log => logger.trace(`${logger.blue(`[${id}]`)} ${log}`),
    debug: log => logger.debug(`${logger.blue(`[${id}]`)} ${log}`),
    info: log => logger.info(`${logger.blue(`[${id}]`)} ${log}`),
    mark: log => logger.mark(`${logger.blue(`[${id}]`)} ${log}`),
    warn: log => logger.warn(`${logger.blue(`[${id}]`)} ${log}`),
    error: log => logger.error(`${logger.blue(`[${id}]`)} ${log}`),
    fatal: log => logger.fatal(`${logger.blue(`[${id}]`)} ${log}`),
  }

  if (!bot.uin) {
    logger.error(`${logger.blue(`[${token}]`)} ICQQBot 连接失败`)
    return false
  }

  Bot[id] = bot

  if (Array.isArray(Bot.uin)) {
    if (!Bot.uin.includes(id))
      Bot.uin.push(id)
  } else {
    Bot.uin = [id]
  }

  Bot[id].on("message", data => {
    data.self_id = id
    data.bot = Bot[id]
    makeMessage(data)
  })

  Bot[id].on("notice", data => {
    data.self_id = id
    data.bot = Bot[id]
    makeNotice(data)
  })

  Bot[id].on("request", data => {
    data.self_id = id
    data.bot = Bot[id]
    makeRequest(data)
  })

  logger.mark(`${logger.blue(`[${id}]`)} ICQQBot 已连接`)
  Bot.emit(`connect.${id}`, Bot[id])
  Bot.emit(`connect`, Bot[id])
  return true
}

Bot.once("online", async () => {
  for (const token of config.token)
    await connectBot(token)
})

export class ICQQ extends plugin {
  constructor () {
    super({
      name: "ICQQ",
      dsc: "ICQQ",
      event: "message",
      rule: [
        {
          reg: "^#[Qq]+账号$",
          fnc: "List",
          permission: "master"
        },
        {
          reg: "^#[Qq]+设置[0-9]:[0-9]+:.*$",
          fnc: "Token",
          permission: "master"
        }
      ]
    })
  }

  async List () {
    await this.reply(`共${config.token.length}个账号：\n${config.token.join("\n")}`, true)
  }

  async Token () {
    const token = this.e.msg.replace(/^#[Qq]+设置/, "").trim()
    if (config.token.includes(token)) {
      config.token = config.token.filter(item => item != token)
      await this.reply(`账号已删除，重启后生效，共${config.token.length}个账号`, true)
    } else {
      if (await connectBot(token)) {
        config.token.push(token)
        await this.reply(`账号已连接，共${config.token.length}个账号`, true)
      } else {
        await this.reply(`账号连接失败`, true)
        return false
      }
    }
    configSave(config)
  }
}

logger.info(logger.green("- ICQQ 插件 加载完成"))