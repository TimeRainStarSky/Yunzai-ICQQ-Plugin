logger.info(logger.yellow("- 正在加载 ICQQ 适配器插件"))

import { config, configSave } from "./Model/config.js"
import { createClient, core } from "icqq"
import common from "../../lib/common/common.js"

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

  async connect(token, send = msg => Bot.sendMasterMsg(msg), get) {
    token = token.split(":")
    const id = Number(token.shift())
    const password = token.shift()
    const cfg = {
      ...config.bot,
      platform: token.shift(),
      data_dir: `${process.cwd()}/data/icqq/${id}`,
    }

    token = token.join(":")
    if (token) {
      if (token.match(/^https?:\/\//)) {
        cfg.sign_api_addr = token
      } else {
        cfg.ver = token
      }
    }

    const bot = createClient(cfg)
    const log = {}
    for (const i of ["trace", "debug", "info", "mark", "warn", "error", "fatal"])
      log[i] = (...args) => Bot.makeLog(i, args, id)
    bot.logger = log
    bot.core = core

    let getTips = "发送 "
    if (typeof get != "function") {
      getTips += `#Bot验证${id}:`
      get = () => new Promise(resolve =>
        Bot.once(`verify.${id}`, data => {
          send = data.reply
          resolve(data.msg)
        })
      )
    }

    bot.on("system.login.qrcode", async data => {
      send([
        `[${id}] 扫码完成后，${getTips}继续登录`,
        segment.image(data.image),
      ])
      while (true) if (await get() == "继续登录") break
      bot.qrcodeLogin()
    })

    bot.on("system.login.slider", async data => {
      send(
        `[${id}] 请选择滑动验证方式\n`+
        `网页验证：${getTips}网页\n`+
        `请求码验证：${getTips}请求码\n`+
        `手动验证：${getTips}ticket\n`+
        data.url
      )
      let msg = await get()
      let fnc
      if (msg == "网页") {
        const url = `https://hlhs-nb.cn/captcha/slider?key=${id}`
        await fetch(url, {
          method: "POST",
          body: JSON.stringify({ url: data.url }),
        })
        send(url)

        fnc = async () => {
          const res = await (await fetch(url, {
            method: "POST",
            body: JSON.stringify({ submit: id }),
          })).json()
          return res.data?.ticket
        }
      } else if (msg == "请求码") {
        const url = data.url.replace("ssl.captcha.qq.com", "txhelper.glitch.me")
        const code = await (await fetch(url)).text()
        send(code)

        fnc = async () => {
          const res = await (await fetch(url)).text()
          if (res != code) return res
        }
      } else {
        return bot.submitSlider(msg)
      }

      let i = 0
      while (true) {
        await Bot.sleep(3000)
        msg = await fnc()
        if (msg) return bot.submitSlider(msg)
        i++
        if (i > 60) return send(`登录超时，发送 #Bot上线${id} 重新登录`)
      }
    })

    bot.on("system.login.device", async data => {
      send(
        `[${id}] 请选择设备锁验证方式\n`+
        `短信验证：${getTips}短信\n`+
        `扫码验证：扫码完成后，${getTips}继续登录\n`+
        data.url
      )
      while (true) {
        const msg = await get()
        if (msg == "短信") {
          bot.sendSmsCode()
          send(`[${id}] 短信已发送，${getTips}验证码`)
          bot.submitSmsCode(await get())
          break
        } else if (msg == "继续登录") {
          bot.login()
          break
        }
      }
    })

    bot.on("system.login.error", data => send(`[${id}] 登录错误：${data.message}(${data.code})\n发送 #Bot上线${id} 重新登录`))
    bot.on("system.offline", data => send(`[${id}] 账号下线：${data.message}\n发送 #Bot上线${id} 重新登录`))
    bot.on("system.online", () => bot.logger = log)

    Bot[id] = bot
    await new Promise(resolve => {
      bot.once("system.online", resolve)
      bot.login(id, password)
    })

    Bot[id].adapter = this
    Bot[id].avatar = Bot[id].pickFriend(id).getAvatarUrl()
    Bot[id].version = {
      id: this.id,
      name: this.name,
      version: this.version,
    }

    Bot[id].on("message", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
    })

    Bot[id].on("notice", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
    })

    Bot[id].on("request", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
    })

    for (const i of ["internal.input", "sync"])
      Bot[id].on(i, data => {
        data.self_id = id
        Bot.em(i, data)
      })

    logger.mark(`${logger.blue(`[${id}]`)} ${this.name}(${this.id}) ${this.version} 已连接`)
    Bot.em(`connect.${id}`, { self_id: id })
    return true
  }

  async load() {
    for (const token of config.token)
      await new Promise(resolve => {
        adapter.connect(token).then(resolve)
        setTimeout(resolve, 5000)
      })
  }
}

Bot.adapter.push(adapter)

export class ICQQAdapter extends plugin {
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
          reg: "^#[Qq]+设置[0-9]+",
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

  List() {
    this.reply(`共${config.token.length}个账号：\n${config.token.join("\n")}`, true)
  }

  async Token() {
    const token = this.e.msg.replace(/^#[Qq]+设置/, "").trim()
    if (config.token.includes(token)) {
      config.token = config.token.filter(item => item != token)
      this.reply(`账号已删除，重启后生效，共${config.token.length}个账号`, true)
    } else {
      if (await adapter.connect(token, msg => this.reply(msg, true), () => Bot.getTextMsg(this.e))) {
        config.token.push(token)
        this.reply(`账号已连接，共${config.token.length}个账号`, true)
      } else {
        this.reply("账号连接失败", true)
        return false
      }
    }
    configSave(config)
  }

  SignUrl() {
    config.bot.sign_api_addr = this.e.msg.replace(/^#[Qq]+签名/, "").trim()
    configSave(config)
    this.reply("签名已设置，重启后生效", true)
  }
}

logger.info(logger.green("- ICQQ 适配器插件 加载完成"))