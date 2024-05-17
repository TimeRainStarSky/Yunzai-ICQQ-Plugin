logger.info(logger.yellow("- 正在加载 ICQQ 适配器插件"))

import makeConfig from "../../lib/plugins/config.js"
import { ulid } from "ulid"

import url from "url"
import path from "path"
import fs from "node:fs/promises"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let icqq
for (const i of ["Model", "node_modules"]) try {
  const dir = `${__dirname}/${i}/icqq/`
  if (!await fs.stat(dir)) continue
  icqq = (await import(`file://${dir}lib/index.js`)).default
  icqq.package = JSON.parse(await fs.readFile(`${dir}package.json`, "utf-8"))
  break
} catch (err) {}

const { config, configSave } = await makeConfig("ICQQ", {
  tips: "",
  permission: "master",
  markdown: {
    mode: false,
    button: false,
    callback: true,
  },
  bot: {},
  token: [],
}, {
  tips: [
    "欢迎使用 TRSS-Yunzai ICQQ Plugin ! 作者：时雨🌌星空",
    "参考：https://github.com/TimeRainStarSky/Yunzai-ICQQ-Plugin",
  ],
})

const adapter = new class ICQQAdapter {
  constructor() {
    this.id = "QQ"
    this.name = "ICQQ"
    this.version = `v${icqq.package.version}`
  }

  async uploadVideo(id, file) {
    const group = Bot[id].pickGroup(Math.ceil(Math.random()*10**9))
    const video = await group.uploadVideo({ file })
    const proto = Bot[id].icqq.core.pb.decode(Buffer.from(video.file.replace("protobuf://", ""), "base64"))
    return group.getVideoUrl(proto[1], proto[2])
  }

  async uploadRecord(id, file) {
    const group = Bot[id].pickGroup(Math.ceil(Math.random()*10**9))
    const record = await group.uploadPtt({ file })
    const proto = Bot[id].icqq.core.pb.decode(Buffer.from(record.file.replace("protobuf://", ""), "base64"))
    const body = Bot[id].icqq.core.pb.encode({ 1: 1200, 2: 0, 14: { 10: id, 20: proto[3], 30: 2 }, 101: 17, 102: 104, 99999: { 90300: 1, 91000: 2, 91100: 1 }})
    const payload = await Bot[id].sendUni("PttCenterSvr.pb_pttCenter_CMD_REQ_APPLY_DOWNLOAD-1200", body)
    const rsp = Bot[id].icqq.core.pb.decode(payload)[14]
    if (rsp[10] !== 0)
      Bot.makeLog("error", [rsp, "获取语音下载地址失败"], id)
    const url = new URL(String(rsp[30][50]))
    url.host = "grouptalk.c2c.qq.com"
    url.protocol = "https"
    return url.href
  }

  async uploadImage(id, file) {
    const image = new Bot[id].icqq.Image({ file })
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

  makeButton(id, pick, button, style, forward) {
    const msg = {
      id: ulid(),
      render_data: {
        label: button.text,
        visited_label: button.clicked_text,
        style,
        ...button.QQBot?.render_data,
      }
    }

    if (button.link)
      msg.action = {
        type: 0,
        permission: { type: 2 },
        data: button.link,
        ...button.QQBot?.action,
      }
    else if (button.input)
      msg.action = {
        type: 2,
        permission: { type: 2 },
        data: button.input,
        enter: button.send,
        ...button.QQBot?.action,
      }
    else if (button.callback)
      msg.action = {
        type: 2,
        permission: { type: 2 },
        data: button.callback,
        enter: true,
        ...button.QQBot?.action,
      }
    else return false

    if (forward && config.markdown.callback && (button.input || button.callback))
      for (const i of Bot.uin)
        if (Bot[i].adapter?.id == "QQBot" && Bot[i].sdk?.config?.appid && Bot[i].callback) {
          msg.action.type = 1
          delete msg.action.data
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

  makeButtons(id, pick, button_square, forward) {
    const msgs = []
    const random = Math.floor(Math.random()*2)
    for (const button_row of button_square) {
      let column = 0
      const buttons = []
      for (let button of button_row) {
        button = this.makeButton(id, pick, button,
          (random+msgs.length+buttons.length)%2, forward)
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
    const forward = []

    for (let i of Array.isArray(msg) ? msg : [msg]) {
      if (typeof i == "object")
        i = { ...i }
      else
        i = { type: "text", text: i }

      switch (i.type) {
        case "text":
          content += this.makeMarkdownText(i.text)
          break
        case "image": {
          const { des, url } = await this.makeMarkdownImage(id, i.file)
          content += `${des}${url}`
          break
        } case "file":
          if (i.file) i.file = await Bot.fileToUrl(i.file, i)
          content += this.makeMarkdownText(`文件：${i.file}`)
          break
        case "at":
          if (i.qq == "all") {
            content += "[@全体成员](mqqapi://markdown/mention?at_type=everyone)"
          } else {
            if (!i.name) {
              let info
              if (pick.pickMember)
                info = pick.pickMember(i.qq).info
              else
                info = Bot[id].pickFriend(i.qq).info
              if (!info)
                info = await Bot[id].pickUser(i.qq).getSimpleInfo()
              if (info)
                i.name = info.card || info.nickname
            }

            if (i.name) i.name += `(${i.qq})`
            else i.name = i.qq
            content += `[@${i.name}](mqqapi://markdown/mention?at_type=1&at_tinyid=${i.qq})`
          }
          break
        case "markdown":
          content += i.data
          break
        case "button":
          button.push(...this.makeButtons(id, pick, i.data, true))
          break
        case "node":
          for (const node of i.data)
            for (const message of await this.makeMarkdownMsg(id, pick, node.message))
              forward.push({ user_id: 80000000, nickname: "匿名消息", ...node, ...message })
          break
        case "raw":
          messages.push([icqq.Converter.prototype.hasOwnProperty(i.data?.type) ? i.data : i])
          break
        default:
          if (icqq.Converter.prototype.hasOwnProperty(i.type)) {
            messages.push([i])
            continue
          }
          content += this.makeMarkdownText(Bot.String(i))
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
      while (button.length)
        messages.push([
          { type: "markdown", content: " " },
          { type: "button", content: {
            appid: this.markdown_appid,
            rows: button.splice(0,5),
          }},
        ])
    }

    for (const i of messages)
      forward.push({ type: "node", message: i })
    return forward
  }

  async makeMsg(id, pick, msg) {
    const message = []
    const messages = []
    const forward = []
    let reply

    for (let i of Array.isArray(msg) ? msg : [msg]) {
      if (typeof i == "object") switch (i.type) {
        case "text":
        case "image":
        case "face":
          break
        case "file":
          await pick.sendFile(i.file, i.name)
          continue
        case "reply":
          reply = i
          continue
        case "at":
          if (i.qq != "all" && !i.name) {
            let info
            if (pick.pickMember)
              info = pick.pickMember(i.qq).info
            else
              info = Bot[id].pickFriend(i.qq).info
            if (!info)
              info = await Bot[id].pickUser(i.qq).getSimpleInfo()
            if (info)
              i.name = info.card || info.nickname
          }
          if (i.name && !i.text)
            i.text = `${i.name}(${i.qq})`
          break
        case "markdown":
          forward.push(...(await this.makeMarkdownMsg(id, pick, msg)))
          continue
        case "button":
          if (config.markdown.button) {
            if (config.markdown.button == "direct" || config.markdown.mode == "mix")
              message.push({
                type: "button",
                appid: this.markdown_appid,
                content: { rows: this.makeButtons(id, pick, i.data)},
              })
            else
              return [await this.makeMarkdownMsg(id, pick, msg)]
          }
          continue
        case "node":
          for (const node of i.data)
            for (const message of await this.makeMsg(id, pick, node.message))
              forward.push({ user_id: 80000000, nickname: "匿名消息", ...node, type: "node", message })
          continue
        case "raw":
          if (icqq.Converter.prototype.hasOwnProperty(i.data?.type))
            i = i.data
          break
        default:
          if (icqq.Converter.prototype.hasOwnProperty(i.type)) {
            messages.push([i])
            continue
          }
          i = Bot.String(i)
      }
      message.push(i)
    }

    if (message.length)
      messages.push(message)
    if (forward.length)
      messages.push(forward)
    if (reply) for (const i of messages)
      i.unshift(reply)
    return messages
  }

  async sendMsg(id, pick, msg, ...args) {
    const rets = { message_id: [], data: [], error: [] }
    let msgs

    const sendMsg = async () => { for (const i of msgs) try {
      Bot.makeLog("debug", ["发送消息", i], id)
      const ret = await pick.sendMsg(i, ...args)
      Bot.makeLog("debug", ["发送消息返回", ret], id)

      rets.data.push(ret)
      if (ret.message_id)
        rets.message_id.push(ret.message_id)
    } catch (err) {
      Bot.makeLog("error", ["发送消息错误", i, err], id)
      rets.error.push(err)
      return false
    }}

    if (config.markdown.mode) {
      if (config.markdown.mode == "mix")
        msgs = [
          ...await this.makeMsg(id, pick, msg),
          await this.makeMarkdownMsg(id, pick, msg),
        ]
      else
        msgs = [await this.makeMarkdownMsg(id, pick, msg)]
    } else {
      msgs = await this.makeMsg(id, pick, msg)
    }

    if (await sendMsg() === false) {
      msgs = await this.makeMsg(id, pick,
        [await Bot.makeForwardMsg([{ message: msg }])])
      await sendMsg()
    }

    if (rets.data.length == 1)
      return rets.data[0]
    return rets
  }

  async recallMsg(id, pick, message_id) {
    Bot.makeLog("info", `撤回消息：${message_id}`, id)
    if (!Array.isArray(message_id))
      message_id = [message_id]
    const msgs = []
    for (const i of message_id)
      msgs.push(await pick.recallMsg(i))
    return msgs
  }

  getPick(id, pick, target, prop, receiver) {
    switch (prop) {
      case "sendMsg":
        return (...args) => this.sendMsg(id, pick, ...args)
      case "recallMsg":
        return message_id => this.recallMsg(id, pick, message_id)
      case "makeForwardMsg":
        return Bot.makeForwardMsg
      case "sendForwardMsg":
        return async (msg, ...args) => this.sendMsg(id, pick, await Bot.makeForwardMsg(msg), ...args)
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

    if (data.post_type == "message") try {
      data.raw_message = data.toString()
    } catch (err) {
      Bot.makeLog("error", err, data.self_id)
    }
  }

  async connect(token, send = msg => Bot.sendMasterMsg(msg), get) {
    token = token.split(":")
    const id = Number(token.shift())
    const password = token.shift()
    const cfg = {
      ...config.bot,
      data_dir: `${process.cwd()}/data/icqq/${id}`,
    }
    const platform = token.shift()
    if (platform) cfg.platform = platform
    const ver = token.shift()
    if (ver) cfg.ver = ver
    const sign_api_addr = token.join(":")
    if (sign_api_addr) cfg.sign_api_addr = sign_api_addr

    const bot = icqq.createClient(cfg)
    const log = {}
    for (const i of ["trace", "debug", "info", "mark", "warn", "error", "fatal"])
      log[i] = (...args) => Bot.makeLog(i, args, id)
    bot.logger = log

    let getTips = "发送 "
    let sendMsg
    if (typeof get != "function") {
      getTips += `#Bot验证${id}:`
      get = () => new Promise(resolve =>
        Bot.once(`verify.${id}`, data => {
          send = data.reply
          sendMsg = true
          resolve(data.msg)
        })
      )
    }

    bot.on("system.login.qrcode", async data => {
      send([
        `[${id}] 扫码登录`,
        segment.image(data.image),
      ])
      while (true) {
        await Bot.sleep(3000)
        const { retcode } = await bot.queryQrcodeResult()
        switch (retcode) {
          case 0:
            return bot.qrcodeLogin()
          case 17:
            return send(`二维码已过期，发送 #Bot上线${id} 重新登录`)
          case 54:
            return send(`登录取消，发送 #Bot上线${id} 重新登录`)
        }
      }
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
    bot.on("system.online", () => {
      bot.logger = log
      if (sendMsg) send(`[${id}] 登录完成`)
    })

    Bot[id] = new Proxy({
      adapter: this,
      sdk: bot,
      icqq,
      avatar: bot.pickFriend(id).getAvatarUrl(),
      version: {
        id: this.id,
        name: this.name,
        version: this.version,
      },
      uploadImage: file => this.uploadImage(id, file),
      uploadRecord: file => this.uploadRecord(id, file),
      uploadVideo: file => this.uploadVideo(id, file),
    }, {
      get: (target, prop, receiver) => this.getBot(id, target, prop, receiver),
    })
    await new Promise(resolve => {
      bot.once("system.online", resolve)
      bot.login(id, password)
    })

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

    Bot.makeLog("mark", `${this.name}(${this.id}) ${this.version} 已连接`, id)
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
    await configSave()
  }

  async SignUrl() {
    config.bot.sign_api_addr = this.e.msg.replace(/^#[Qq]+签名/, "").trim()
    await configSave()
    this.reply("签名已设置，重启后生效", true)
  }
}

logger.info(logger.green("- ICQQ 适配器插件 加载完成"))