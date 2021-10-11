import { exec, OutputMode } from "https://deno.land/x/exec/mod.ts";

class Docker {
  stackName = async () => (await this.dockerCmd("stack ls --format \"{{.Name}}\"")).split("\n")[0]

  private async dockerCmd(cmd: string, output: OutputMode = OutputMode.Capture) {
    let result;
    try {
      result = (await exec(`docker ${cmd}`, { output })).output;
      try {
        result = JSON.parse(result)[0];
      } catch {
        return result;
      }
    } catch {
      return undefined;
    }
    return result;
  }

  update = async (service: string, image: string, params: { workdir?: string, ports?: string[], volumes?: string[] }) => {
    const stack = await this.stackName();
    const oldService = await this.data(service);
    if (oldService.version && oldService.updatedAt)
      await this.dockerCmd(`service update --with-registry-auth --force --image ${image} ${stack}_${service}`);
    else {
      const volume = params?.volumes?.map((volume: string) => {
        const vol = volume.split(":");
        return `--mount type=bind,source=${vol[0]},destination=${vol[1]}`;
      }).join(" ") || "";
      const port = params?.ports?.map((port: string) => `--publish ${port}`).join(" ") || "";
      const wd = params?.workdir ? `-w ${params?.workdir}` : "";
      const cmd = `service create --with-registry-auth ${volume} ${wd} ${port} --name ${stack}_${service} ${image}`;
      await this.dockerCmd(cmd);
    }
    const newService = await this.data(service);
    return oldService.version !== newService?.version || oldService.updatedAt !== newService?.updatedAt;
  }

  rollback = async (service: string) => {
    const stack = await this.stackName();
    await this.dockerCmd(`service rollback ${stack}_${service}`);
    return await true;
  }

  data = async (service: string) => {
    const stack = await this.stackName();
    const result = await this.dockerCmd(`service inspect ${stack}_${service}`);
    const temp = result?.Spec?.TaskTemplate?.ContainerSpec?.Image?.split(":");
    const { output } = await exec(`docker service ls -f "name=${stack}_${service}" --format "{{.Ports}}"`, { output: OutputMode.Capture });
    const ports: number[] = [];
    output.split("\n")[0].split(", ").forEach((port: string) => {
      const temp = port.split("->")[0].split("*:");
      const temp2 = temp[temp.length - 1];
      if (temp2) {
        const temp3 = temp2.split("-");
        if (temp3.length > 1)
          for (let i = parseInt(temp3[0]); i <= parseInt(temp3[1]); i++)
            ports.push(i);
        else ports.push(parseInt(temp3[0]));
      }
    });
    return {
      version: temp ? temp[temp.length - 1] : undefined,
      updatedAt: result?.UpdatedAt,
      ports
    };
  }

  list = async () => JSON.parse(`[${(await this.dockerCmd(`service ls --format "{{json .}}"`)).split("\n").join(",")}]`)

  async remove(service: string) {
    const stack = await this.stackName();
    return !!(await this.dockerCmd(`service rm ${stack}_${service}`));
  }

  async logs(service: string) {
    const stack = await this.stackName();
    return (await this.dockerCmd(`service logs --raw ${stack}_${service}`)).split("\n");
  }

  prune = async () => Math.max(0, (await this.dockerCmd(`container prune -f`)).split("\n").length - 3)

  async scale(service: string, value: number) {
    const stack = await this.stackName();
    await this.dockerCmd(`service scale ${stack}_${service}=${value}`)
  }

  ip = async () => await this.dockerCmd("info -f \"{{.Swarm.NodeAddr}}\"")
}

export const docker = new Docker;
