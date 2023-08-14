logger.info(logger.yellow("- 正在加载 ICQQ 适配器插件"))

import { config, configSave } from "./Model/config.js"
import { createClient, core } from "icqq"

const adapter = new class ICQQAdapter {
  constructor() {
    this.id = "QQ"
    this.name = "ICQQ"
    this.version = config.package.dependencies.icqq.replace("^", "v")
  }

  makeEvent(data) {
    for (const i of [data.friend, data.group, data.member]) {
      if (typeof i != "object") continue
      if (!i.getInfo) i.getInfo = () => i.info
    }
  }

  makeMessage(data) {
    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  makeNotice(data) {
    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.notice_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  makeRequest(data) {
    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.request_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  async connect(token, send = msg => Bot.sendMasterMsg(msg), get = () => Bot.getMasterMsg()) {
    token = token.split(":")
    const id = Number(token[0])
    const bot = createClient({
      ...config.bot,
      platform: token[2],
      ver: token[3],
      data_dir: `${process.cwd()}/data/icqq/${id}`,
    })
    const log = {
      trace: log => logger.trace(`${logger.blue(`[${id}]`)} ${log}`),
      debug: log => logger.debug(`${logger.blue(`[${id}]`)} ${log}`),
      info: log => logger.info(`${logger.blue(`[${id}]`)} ${log}`),
      mark: log => logger.mark(`${logger.blue(`[${id}]`)} ${log}`),
      warn: log => logger.warn(`${logger.blue(`[${id}]`)} ${log}`),
      error: log => logger.error(`${logger.blue(`[${id}]`)} ${log}`),
      fatal: log => logger.fatal(`${logger.blue(`[${id}]`)} ${log}`),
    }
    bot.logger = log
    bot.core = core

    bot.on("system.login.qrcode", async data => {
      send([`[${id}] 扫码完成后，回复 任意消息 继续登录`, segment.image(data.image)])
      await get()
      bot.qrcodeLogin()
    })

    bot.on("system.login.slider", async data => {
      send(`[${id}] 滑动验证完成后，回复 ticket 继续登录\n${data.url}`)
      bot.submitSlider(await get())
    })

    bot.on("system.login.device", async data => {
      send(`[${id}] 请选择设备锁验证方式\n短信验证：回复 短信 继续登录\n扫码验证：扫码完成后，回复 任意消息 继续登录\n${data.url}`)
      const msg = await get()
      if (msg == "短信") {
        bot.sendSmsCode()
        send(`[${id}] 短信已发送，回复 验证码 继续登录`)
        bot.submitSmsCode(await get())
      } else {
        bot.login()
      }
    })

    bot.on("system.login.error", data => send(`[${id}] 登录错误：${data.message}(${data.code})`))
    bot.on("system.offline", data => send(`[${id}] 账号下线：${data.message}`))
    bot.on("system.online", () => bot.logger = log)

    if (await new Promise(resolve => {
      bot.once("system.online", () => resolve(false))
      bot.once("system.login.error", () => resolve(true))
      bot.login(id, token[1])
    })) {
      logger.error(`${logger.blue(`[${token}]`)} ${this.name}(${this.id}) ${this.version} 连接失败`)
      return false
    }

    Bot[id] = bot
    Bot[id].adapter = this
    Bot[id].avatar = Bot[id].pickFriend(id).getAvatarUrl()
    Bot[id].version = {
      id: this.id,
      name: this.name,
      version: this.version,
    }

    if (!Bot.uin.includes(id))
      Bot.uin.push(id)

    Bot[id].on("message", data => {
      data.bot = Bot[id]
      this.makeEvent(data)
      this.makeMessage(data)
    })

    Bot[id].on("notice", data => {
      data.bot = Bot[id]
      this.makeEvent(data)
      this.makeNotice(data)
    })

    Bot[id].on("request", data => {
      data.bot = Bot[id]
      this.makeEvent(data)
      this.makeRequest(data)
    })

    logger.mark(`${logger.blue(`[${id}]`)} ${this.name}(${this.id}) ${this.version} 已连接`)
    Bot.emit(`connect.${id}`, Bot[id])
    Bot.emit("connect", Bot[id])
    return true
  }

  async load() {
    for (const token of config.token)
      await adapter.connect(token)
    return true
  }
}

Bot.adapter.push(adapter)

export class ICQQ extends plugin {
  constructor() {
    super({
      name: "ICQQAdapter",
      dsc: "ICQQ 适配器设置",
      event: "message",
      rule: [
        {
          reg: "^#[Qq]+账号$",
          fnc: "List",
          permission: config.permission,
        },
        {
          reg: "^#[Qq]+设置[0-9]+:.*:[0-9]+:.*$",
          fnc: "Token",
          permission: config.permission,
        },
        {
          reg: "^#[Qq]+签名.+$",
          fnc: "SignUrl",
          permission: config.permission,
        }
      ]
    })
  }

  async List() {
    await this.reply(`共${config.token.length}个账号：\n${config.token.join("\n")}`, true)
  }

  async Token() {
    const token = this.e.msg.replace(/^#[Qq]+设置/, "").trim()
    if (config.token.includes(token)) {
      config.token = config.token.filter(item => item != token)
      await this.reply(`账号已删除，重启后生效，共${config.token.length}个账号`, true)
    } else {
      if (await adapter.connect(token, msg => this.reply(msg, true), () => Bot.getFriendMsg(this.e))) {
        config.token.push(token)
        await this.reply(`账号已连接，共${config.token.length}个账号`, true)
      } else {
        await this.reply(`账号连接失败`, true)
        return false
      }
    }
    configSave(config)
  }

  async SignUrl() {
    config.bot.sign_api_addr = this.e.msg.replace(/^#[Qq]+签名/, "").trim()
    configSave(config)
    await this.reply("签名已设置，重启后生效", true)
  }
}

logger.info(logger.green("- ICQQ 适配器插件 加载完成"))