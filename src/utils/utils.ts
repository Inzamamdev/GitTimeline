import * as vscode from "vscode";
import crypto from "crypto";
const { GoogleGenerativeAI } = require("@google/generative-ai");

const BASE_PROMPT =
  'You are an Devops Pro and what ever code I will give you will provide a simple one line commit message which will be pushed to github so make the message clear according to the code and an good brief summary and little explaination of the code along with previous code for reference if there is relation between both the code only then refer it else leave it summary should be explanatory and should have current code in it and it should be in md format and also it should have the code in it make it as an readme.md file also you will ignore errors in the code response will be a json like {commit:"",summary:""},also no explanation just json without backtick make the format easy to parse as json';
let callCount = 0;
let prevContent: string = "";

function generateFileHash(content: string): string {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(content);
  return hashSum.digest('hex');
}

function storeHashesInGlobalState(fileHash: string, context: vscode.ExtensionContext) {
  const existingHashes = getHashesFromGlobalState(context);
  const newHashes = [...existingHashes, fileHash];
  context.globalState.update('fileHashes', newHashes);
}

function getHashesFromGlobalState(context: vscode.ExtensionContext): [] {
  return context.globalState.get('fileHashes') || [];
}

function compareAndStoreHashes(context: vscode.ExtensionContext, content: string): boolean {
  const existingHashes = getHashesFromGlobalState(context);
  const fileHash = generateFileHash(content);
  return existingHashes.some((entry: string) => entry === fileHash);
}

export async function octokitInstance(token: string) {
  const Octokit = await import("@octokit/rest");
  return new Octokit.Octokit({ auth: token });
}

async function getGoogleGenerativeAI(
  content: string,
  prevContent: string,
  input: string | undefined
) {
  if (!input && !process.env.API_KEY) {
    vscode.window.showErrorMessage("API key is missing");
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.API_KEY || input);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      `${BASE_PROMPT}\n\ncurrent Code:\n${content}\n\nprevious code:\n${prevContent}`
    );
    prevContent = content;
    console.log(result.response.text());
    return JSON.parse(
      result.response
        .text()
        .replace(/```json/g, "")
        .trim()
        .slice(0, -4)
    );
  } catch (err) {
    vscode.window.showErrorMessage("API key is invalid");
  }
}

export async function getSavedContent(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  user: string,
  repoName: string,
  token: string,
  input: string | undefined
) {
  callCount = context.globalState.get<number>("callCount", 0);
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  if (
    diagnostics.some(
      (diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error
    )
  ) {
    vscode.window.showErrorMessage(
      "The file contains errors. Fix them before saving."
    );
    return;
  }

  const octokit = await octokitInstance(token);
  const content = document.getText();

  if (content === "") {
    vscode.window.showErrorMessage(
      "The file is empty. Add some content before saving."
    );
    return;
  }
  if (prevContent === "") {
    prevContent = content;
  }
  const commitMessage = await getGoogleGenerativeAI(
    content,
    prevContent,
    input
  );

  const fileName = `tasklog${callCount + 1}.md`;
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: user,
      repo: repoName,
      path: fileName,
    });
    if (!Array.isArray(data) && data.sha) sha = data.sha;
  } catch (err: any) {
    if (err.status !== 404) throw err;
  }

  if (compareAndStoreHashes(context, content)) {
    vscode.window.showInformationMessage(
      `The file "${fileName}" content already exists in the repository.`
    );
    return;
  }

  storeHashesInGlobalState(generateFileHash(content), context);

  const encodedContent = Buffer.from(commitMessage.summary).toString("base64");
  await octokit.rest.repos
    .createOrUpdateFileContents({
      owner: user,
      repo: repoName,
      path: fileName,
      message: commitMessage.commit.split(":")[1],
      content: encodedContent,
      sha,
    })
    .then(async () => {
      callCount += 1;
      await context.globalState.update("callCount", callCount);
      vscode.window.showInformationMessage(
        `File "${fileName}" updated in "${repoName}".`
      );
    });
}
