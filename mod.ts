import AsciiTable from "https://deno.land/x/ascii_table/mod.ts";

export enum OutputMode {
  JSON, // JSON the output and return it
  Table, // table output and return a ansii string
}

export type OptionsType = {
  verbose?: boolean;
  services?: boolean;
  modules?: string;
  system?: string;
  username?: string;
  password?: string;
  filter?: any[];
  apps?: boolean;
  output?: OutputMode;
};

const csvHeaders: {
  [Key in string]: string[];
} = {
  default: ["imageName", "pid", "sessionName", "sessionNumber", "memUsage"],
  defaultVerbose: [
    "imageName",
    "pid",
    "sessionName",
    "sessionNumber",
    "memUsage",
    "status",
    "username",
    "cpuTime",
    "windowTitle",
  ],
  apps: ["imageName", "pid", "memUsage", "packageName"],
  appsVerbose: [
    "imageName",
    "pid",
    "sessionName",
    "sessionNumber",
    "memUsage",
    "status",
    "username",
    "cpuTime",
    "windowTitle",
    "packageName",
  ],
  modules: ["imageName", "pid", "modules"],
  services: ["imageName", "pid", "services"],
};

function CSVtoArray(text: string): string[] {
  var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
  var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
  // Return NULL if input string is not well formed CSV string.
  if (!re_valid.test(text)) return [""];
  var a = []; // Initialize array to receive values.
  text.replace(
    re_value, // "Walk" the string using replace with callback.
    function (m0: any, m1: any, m2: any, m3: any) {
      // Remove backslash from \' in single quoted values.
      if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
      // Remove backslash from \" in double quoted values.
      else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
      else if (m3 !== undefined) a.push(m3);
      return ""; // Return empty string.
    }
  );
  // Handle special case of empty last value.
  if (/,\s*$/.test(text)) a.push("");
  return a;
}

function wrapText(
  text: string,
  len: number = 20,
  useDot: boolean = true
): string {
  return text.length > len
    ? `${text.slice(0, len)}${useDot ? " ..." : ""}`
    : text;
}

export async function tasklist({
  verbose = false,
  services = false,
  filter = [],
  apps = false,
  output = OutputMode.JSON,
  modules,
  username,
  system,
  password,
}: OptionsType): Promise<{
  status: {
    code: number;
    success: boolean;
  };
  output: string | any[];
}> {
  if (Deno.build.os !== "windows") {
    throw new Error("Windows only");
  }

  if (verbose === true && (services === true || modules !== undefined)) {
    throw new Error(
      "Verbose option is invalid when Services or Modules option is set"
    );
  }

  if (modules !== undefined && services === true) {
    throw new Error("The Services and Modules options can't be used together");
  }

  // Check if system, username and password is specified together
  const remoteParams = [system, username, password];
  let isRemote;
  if (remoteParams.every((value) => value === undefined)) {
    // All params are undefined
    isRemote = false;
  } else if (remoteParams.some((value) => value === undefined)) {
    // Some, but not all of the params are undefined
    throw new Error(
      "The System, Username and Password options must be specified together"
    );
  } else {
    isRemote = true;
  }

  // Check for unsupported filters on remote machines
  if (Array.isArray(filter) && isRemote) {
    filter.forEach((filter) => {
      const parameter = filter.split(" ")[0].toLowerCase();
      if (parameter === "windowtitle" || parameter === "status") {
        throw new Error(
          "Windowtitle and Status parameters for filtering are not supported when querying remote machines"
        );
      }
    });
  }

  // Populate args
  const args = ["/nh", "/fo", "csv"];

  if (verbose) {
    args.push("/v");
  }

  if (apps) {
    args.push("/apps");
  }

  if (modules !== undefined) {
    args.push("/m");
    if (modules !== "") {
      args.push(modules);
    }
  }

  if (services) {
    args.push("/svc");
  }

  if (isRemote) {
    args.push("/s", <any>system, "/u", <any>username, "/p", <any>password);
  }

  if (Array.isArray(filter)) {
    for (const fi of filter) {
      args.push("/fi", fi);
    }
  }

  let currentHeader;
  if (apps) {
    currentHeader = "apps";
  } else if (modules !== undefined) {
    currentHeader = "modules";
  } else if (services) {
    currentHeader = "services";
  } else {
    currentHeader = "default";
  }

  if (verbose) {
    currentHeader += "Verbose";
  }

  const columns = csvHeaders[currentHeader];
  let response = {
    status: {
      code: -1,
      success: false,
    },
    output: [],
  };

  let p = Deno.run({
    cmd: ["tasklist.exe", ...args],
    stdout: "piped",
    stderr: "piped",
  });

  const buff = await p.output();
  const status = await p.status();
  const op = new TextDecoder().decode(buff);

  const csvArr: any[] = op
    .trim()
    .split("\n")
    .map((n: string) => CSVtoArray(n))
    .map((n: string[]) => n.map((m: string) => wrapText(m)));

  if (output === OutputMode.Table) {
    response = {
      status,
      output: <any>AsciiTable.fromJSON({
        title: "Tasklist",
        heading: columns,
        rows: csvArr,
      }).toString(),
    };
  }

  if (output === OutputMode.JSON) {
    response = {
      status,
      output: <any>(
        csvArr.map((n) =>
          Object.assign({}, ...columns.map((v, i) => ({ [v]: (<any>n)[i] })))
        )
      ),
    };
  }

  // https://github.com/denoland/deno/issues/4830
  /* p.stdout?.close();
  p.stderr?.close(); */
  p.close();

  return response;
}

/* console.log(
  await tasklist({
    filter: ["imagename eq does-not-exist"],
  })
); */
