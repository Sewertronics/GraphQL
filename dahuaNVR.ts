import { crypto } from "https://deno.land/std@0.106.0/crypto/mod.ts";
import { Hash } from "https://deno.land/x/checksum@1.4.0/mod.ts";

export enum RecordMode {
  Auto,
  Manual,
  Off
}

interface SaveVideo {
  fileName?: string;
  channel?: number;
  startTime: string;
  endTime: string;
  subtype?: number;
}

type Command = "magicBox" | "snapshot" | "loadfile" | "global" | "configManager";

interface Params {
  channel?: number;
  action?: "getSystemInfo" | "startLoad" | "getCurrentTime" | "setConfig" | "getConfig";
  startTime?: string;
  endTime?: string;
  subtype?: number;
  name?: "ChannelTitle"
}

type koParams = keyof Params;

export class DahuaNVR {
  private count = 0;
  private readonly ip: string;
  private readonly user: string;
  private readonly password: string;

  constructor(ip = "192.168.1.1", user = "admin", password = "admin") {
    this.ip = ip;
    this.user = user;
    this.password = password;
  }

  private get = async (url: string) => {
    const request = (req: string) => {
      const authDetails = req.split(', ').map((v: string) => v.split('='));
      const nonceCount = ('00000000' + ++this.count).slice(-8);
      const temp: string[] = [];
      crypto.getRandomValues(new Uint8Array(24)).forEach((value: number) => temp.push(value.toString(16)));
      const cnonce = temp.join("");
      const realm = (authDetails.find(([ el ]: string[]) => el.toLowerCase().indexOf("realm") > -1) as string[])[1].replace(/"/g, '');
      const nonce = (authDetails.find(([ el ]: string[]) => el.toLowerCase().indexOf("nonce") > -1) as string[])[1].replace(/"/g, '');
      const opaque = (authDetails.find(([ el ]: string[]) => el.toLowerCase().indexOf("opaque") > -1) as string[])[1].replace(/"/g, '');
      const ha1 = new Hash("md5").digestString(`${this.user}:${realm}:${this.password}`).hex();
      const path = `/${url.split("//")[1].split("/").slice(1).join("/")}`;
      const ha2 = new Hash("md5").digestString(`GET:${path}`).hex();
      const response = new Hash("md5").digestString(`${ha1}:${nonce}:${nonceCount}:${cnonce}:auth:${ha2}`).hex();
      return `Digest username="${this.user}", realm="${realm}", nonce="${nonce}", uri="${path}", cnonce="${cnonce}", nc=${nonceCount}, qop=auth, response="${response}", opaque="${opaque}"`;
    };
    return await new Uint8Array(await (await fetch(url, {
      headers: {
        Authorization: request((await fetch(url)).headers.get("www-authenticate") || "")
      }
    })).arrayBuffer());
  };

  private sendToAPI = async (command: Command, params: Params) => await this.get(`http://${this.ip}/cgi-bin/${command}.cgi?${(Object.keys(params) as koParams[]).map((param: koParams) => `${param}=${params[param]}`).join("&")}`);

  getSystemInfo = async () => {
    const obj: {
      [x: string]: string;
    } = {
    };
    (new TextDecoder().decode(await this.sendToAPI("magicBox", {
      action: "getSystemInfo"
    }))).trim().split("\r\n").forEach((v: string) => {
      const [ key, value ] = v.split("=");
      obj[key] = value;
    });
    return obj;
  }

  snapshot = async (channel = 1) => await this.sendToAPI("snapshot", {
    channel
  });

  saveSnapshot = async (fileName = "snapshot.jpg", channel = 1) => await Deno.writeFile(fileName, await this.snapshot(channel));

  saveVideo = async ({ fileName = "video", channel = 1, startTime, endTime, subtype = 0 }: SaveVideo, resolution = "1920x1080") => {
    await Deno.writeFile(`${fileName}.dav`, await this.sendToAPI("loadfile", {
      action: "startLoad",
      channel,
      startTime,
      endTime,
      subtype
    }));
    await Deno.run({
      cmd: `ffmpeg -y -i ${fileName}.dav -c:v libx264 -s ${resolution} -crf 24 ${fileName}.mp4`.split(" ")
    }).status();
    await Deno.run({
      cmd: `rm ${fileName}.dav`.split(" ")
    }).status();
  };

  getCurrentTime = async () => (new TextDecoder().decode(await this.sendToAPI("global", {
    action: "getCurrentTime"
  }))).trim().split("=")[1];

  recordMode = async (channel = 1, mode = RecordMode.Auto) => await this.sendToAPI("configManager", {
    action: "setConfig",
    [`RecordMode[${channel - 1}].Mode`]: mode
  });

  startRecordingVideo = (channel = 1, fileName = "video", subtype = 0) => Deno.run({
    cmd: `ffmpeg -i rtsp://${this.user}:${this.password}@${this.ip}/cam/realmonitor?channel=${channel}\&subtype=${subtype} -acodec copy -y -vcodec copy ./${fileName}.mp4`.split(" "),
    stdout: "piped"
  }).status();

  stopRecordingVideo = async () => await Deno.run({
    cmd: "pkill -x ffmpeg".split(" "),
    stdout: "piped"
  }).status();

  getChannelName = async (channel = 1) => (new TextDecoder().decode(await this.sendToAPI("configManager", {
    action: "getConfig",
    name: "ChannelTitle"
  }))).trim().split("\r\n").map((channel: string) => channel.split("=")[1])[channel - 1];

  setChannelName = async (channel = 1, text = "") => await this.sendToAPI("configManager", {
    action: "setConfig",
    [`ChannelTitle[${channel - 1}].Name`]: text.length ? text.replaceAll(" ", "%20") : "%20"
  });

  getInspectionsList = async () => {
    try {
      const inspectionsList: string[] = [];
      for await (const dirEntry of Deno.readDir('../inspections'))
        if (dirEntry.isFile)
          inspectionsList.push(dirEntry.name);
      return inspectionsList;
    } catch {
      return [];
    }
  }
}