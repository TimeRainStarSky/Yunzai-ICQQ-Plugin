logger.info(logger.yellow("- 正在加载 ICQQ 适配器插件"))

import { config, configSave } from "./Model/config.js"
import icqq from "./Model/icqq/lib/index.js"
import { randomUUID } from "node:crypto"

const adapter = new class ICQQAdapter {
  constructor() {
    this.id = "QQ"
    this.name = "ICQQ"
    this.version = config.package.dependencies.icqq.replace("^", "v")
  }

  async uploadImage(id, file) {
    const image = new Bot[id].icqq.Image(segment.image(file))
    image.upload = await Bot[id].pickGroup(Math.ceil(Math.random()*10**9)).uploadImages([image])
    if (image.upload[0].status == "fulfilled")
      image.url = Bot[id].icqq.getGroupImageUrl(image.md5.toString("hex"))
    return image
  }

  async makeMarkdownImage(id, file) {
    const image = await Bot[id].uploadImage(file)
    return {
      des: `![图片 #${image.width || 0}px #${image.height || 0}px]`,
      url: `(${image.url})`,
    }
  }

  makeMarkdownText(text) {
    const match = text.match(/https?:\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/g)
    if (match) for (const url of match)
      text = text.replace(url, `<${url}>`)
    return text
  }

  makeButton(id, pick, button, style) {
    const msg = {
      id: randomUUID(),
      render_data: {
        label: button.text,
        visited_label: button.clicked_text,
        style,
        ...button.ICQQ?.render_data,
      }
    }

    if (button.link)
      msg.action = {
        type: 0,
        permission: { type: 2 },
        data: button.link,
        ...button.ICQQ?.action,
      }
    else if (config.markdown.callback && (button.input || button.callback))
      for (const i of Bot.uin)
        if (Bot[i].adapter?.id == "QQBot" && Bot[i].sdk?.config?.appid && Bot[i].callback) {
          msg.action = {
            type: 1,
            permission: { type: 2 },
            ...button.ICQQ?.action,
          }
          this.markdown_appid = Number(Bot[i].sdk.config.appid)
          Bot[i].callback[msg.id] = {
            self_id: id,
            user_id: pick.user_id,
            group_id: pick.group_id,
            message: button.input || button.callback,
          }
          setTimeout(() => delete Bot[i].callback[msg.id], 3600000)
          break
        }

    if (!msg.action) {
      if (button.input)
        msg.action = {
          type: 2,
          permission: { type: 2 },
          data: button.input,
          enter: button.send,
          ...button.ICQQ?.action,
        }
      else if (button.callback) {
        if (!msg.action)
          msg.action = {
            type: 2,
            permission: { type: 2 },
            data: button.callback,
            enter: true,
            ...button.ICQQ?.action,
          }
      } else return false
    }

    if (button.permission) {
      if (button.permission == "admin") {
        msg.action.permission.type = 1
      } else {
        msg.action.permission.type = 0
        msg.action.permission.specify_user_ids = String(button.permission)
      }
    }
    return msg
  }

  makeButtons(id, pick, button_square) {
    const msgs = []
    const random = Math.floor(Math.random()*2)
    for (const button_row of button_square) {
      let column = 0
      const buttons = []
      for (let button of button_row) {
        button = this.makeButton(id, pick, button,
          (random+msgs.length+buttons.length)%2)
        if (button) buttons.push(button)
      }
      if (buttons.length)
        msgs.push({ buttons })
    }
    return msgs
  }

  async makeMarkdownMsg(id, pick, msg) {
    const messages = []
    let content = ""
    const button = []
    let reply
    const forward = []

    for (let i of msg) {
      if (typeof i == "object")
        i = { ...i }
      else
        i = { type: "text", text: i }

      switch (i.type) {
        case "record":
        case "video":
        case "xml":
        case "json":
        case "face":
          messages.push([i])
          break
        case "file":
          if (i.file) i.file = await Bot.fileToUrl(i.file, i)
          content += this.makeMarkdownText(`文件：${i.file}`)
          break
        case "at":
          if (i.qq == "all")
            content += "[@全体成员](mqqapi://markdown/mention?at_type=everyone)"
          else
            content += `[@${i.name || i.qq}](mqqapi://markdown/mention?at_type=1&at_tinyid=${i.qq})`
          break
        case "text":
          content += this.makeMarkdownText(i.text)
          break
        case "image": {
          const { des, url } = await this.makeMarkdownImage(id, i.file)
          content += `${des}${url}`
          break
        } case "markdown":
          content += i.data
          break
        case "button":
          button.push(...this.makeButtons(id, pick, i.data))
          break
        case "reply":
          reply = i
          continue
        case "node":
          for (const node of i.data)
            for (const message of await this.makeMarkdownMsg(id, pick, node.message))
              forward.push({ ...node, ...message })
          continue
        case "raw":
          messages.push([i.data])
          break
        default:
          content += this.makeMarkdownText(JSON.stringify(i))
      }
    }

    if (content)
      messages.unshift([{ type: "markdown", content }])

    if (button.length) {
      for (const i of messages) {
        if (i[0].type == "markdown")
          i.push({ type: "button", content: {
            appid: this.markdown_appid,
            rows: button.splice(0,5),
          }})
        if (!button.length) break
      }
      while (button.length) {
        messages.push([
          { type: "markdown", content: " " },
          { type: "button", content: {
            appid: this.markdown_appid,
            rows: button.splice(0,5),
          }},
        ])
      }
    }

    for (const i of messages)
      forward.push({ type: "node", message: i })
    return forward
  }

  async makeMsg(id, pick, msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    if (config.markdown.global)
      return this.makeMarkdownMsg(id, pick, msg)

    const msgs = []
    for (let i of msg) {
      if (typeof i == "object") switch (i.type) {
        case "markdown":
          msgs.push(...(await this.makeMarkdownMsg(id, pick, msg)))
          continue
        case "button":
          if (config.markdown.button) {
            if (config.markdown.button == "direct")
              msgs.push({ type: "button", content: { rows: this.makeButtons(i.data) }})
            else
              return this.makeMarkdownMsg(id, pick, msg)
          }
          continue
        case "node":
          for (const node of i.data)
            msgs.push({ ...node, type: "node",
              message: await this.makeMsg(id, pick, node.message) })
          continue
      }
      msgs.push(i)
    }
    return msgs
  }

  getPick(id, pick, target, prop, receiver) {
    switch (prop) {
      case "sendMsg":
        return async (msg, ...args) => pick.sendMsg(await this.makeMsg(id, pick, msg), ...args)
      case "makeForwardMsg":
        return Bot.makeForwardMsg
      case "sendForwardMsg":
        return async (msg, ...args) => pick.sendMsg(await this.makeMsg(id, pick, await Bot.makeForwardMsg(msg)), ...args)
      case "getInfo":
        return () => pick.info
      case "pickMember":
        return (...args) => {
          for (const i in args)
            args[i] = Number(args[i]) || args[i]
          const pickMember = pick[prop](...args)
          return new Proxy({}, {
            get: (target, prop, receiver) => this.getPick(id, pickMember, target, prop, receiver),
          })
        }
    }
    return target[prop] ?? pick[prop]
  }

  getBot(id, target, prop, receiver) {
    switch (prop) {
      case "pickUser":
      case "pickFriend":
      case "pickGroup":
      case "pickMember":
        return (...args) => {
          for (const i in args)
            args[i] = Number(args[i]) || args[i]
          const pick = target.sdk[prop](...args)
          return new Proxy({}, {
            get: (target, prop, receiver) => this.getPick(id, pick, target, prop, receiver),
          })
        }
    }
    return target[prop] ?? target.sdk[prop]
  }

  makeEvent(data) {
    for (const i of ["friend", "group", "member"]) {
      if (typeof data[i] != "object") continue
      const pick = data[i]
      data[i] = new Proxy({}, {
        get: (target, prop, receiver) => this.getPick(data.self_id, pick, target, prop, receiver),
      })
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

    const bot = icqq.createClient(cfg)
    const log = {}
    for (const i of ["trace", "debug", "info", "mark", "warn", "error", "fatal"])
      log[i] = (...args) => Bot.makeLog(i, args, id)
    bot.logger = log

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
      const msg = await get()
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
        const msg = await fnc()
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

    bot.on("system.login.error", data => send(
      `[${id}] 登录错误：${data.message}(${data.code})\n`+
      `发送 #Bot上线${id} 重新登录`
    ))
    bot.on("system.offline", data => send(
      `[${id}] 账号下线：${data.message}\n`+
      `发送 #Bot上线${id} 重新登录`
    ))
    bot.on("system.online", () => bot.logger = log)

    Bot[id] = new Proxy({
      adapter: this,
      sdk: bot,
      icqq,
      version: {
        id: this.id,
        name: this.name,
        version: this.version,
      },
      uploadImage: file => this.uploadImage(id, file),
    }, {
      get: (target, prop, receiver) => this.getBot(id, target, prop, receiver),
    })
    await new Promise(resolve => {
      bot.once("system.online", resolve)
      bot.login(id, password)
    })

    Bot[id].avatar = bot.pickFriend(id).getAvatarUrl()

    bot.on("message", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
    })

    bot.on("notice", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
    })

    bot.on("request", data => {
      this.makeEvent(data)
      Bot.em(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
    })

    for (const i of ["internal.input", "sync"])
      bot.on(i, data => {
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