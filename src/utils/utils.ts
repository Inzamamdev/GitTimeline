import * as vscode from "vscode";
import crypto from "crypto";
const { GoogleGenerativeAI } = require("@google/generative-ai");

const BASE_PROMPT =
  'You are an Devops Pro and what ever code I will give you will provide a simple one line commit message which will be pushed to github so make the message clear according to the code and an good brief summary and little explaination of the code along with previous code for reference if there is relation between both the code only then refer it else leave it summary should be explanatory and should have current code in it and it should be in md format and also it should have the code in it make it as an readme.md file also you will ignore errors in the code response will be a json like {commit:"",summary:""},also no explanation just json without backtick make the format easy to parse as json';
let callCount = 0;
let prevContent: string = "";

export async function octokitInstance(token: string) {
  const Octokit = await import("@octokit/rest");
  return new Octokit.Octokit({ auth: token });
}

async function getGoogleGenerativeAI(content: string, prevContent: string) {
  const genAI = new GoogleGenerativeAI(process.env.API_KEY);
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
}
async function getRecentFileHashes(
  octokit: any,
  user: string,
  repoName: string,
  sinceDurationMs: number
): Promise<string[]> {
  const now = new Date();
  const since = new Date(now.getTime() - sinceDurationMs).toISOString();
  const recentFileHashes: string[] = [];

  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: user,
      repo: repoName,
      since,
    });

    for (const commit of commits) {
      const { data: commitDetails } = await octokit.rest.repos.getCommit({
        owner: user,
        repo: repoName,
        ref: commit.sha,
      });

      for (const file of commitDetails.files || []) {
        if (file.sha) {
          recentFileHashes.push(file.sha);
        }
      }
    }
  } catch (err) {
    console.error("Error fetching recent file hashes:", err);
  }

  return recentFileHashes;
}

function computeGitHubCompatibleHash(content: string): string {
  const fileSize = Buffer.byteLength(content, "utf8");
  const blob = `blob ${fileSize}\0${content}`;
  return crypto.createHash("sha1").update(blob).digest("hex");
}

export async function getSavedContent(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  user: string,
  repoName: string,
  token: string
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
  const commitMessage = await getGoogleGenerativeAI(content, prevContent);

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
  const newFileHash = computeGitHubCompatibleHash(content);

  console.log("newFileHash", newFileHash);

  const ONE_HOUR_MS = 60 * 60 * 1000;

  const recentHashes = await getRecentFileHashes(
    octokit,
    user,
    repoName,
    ONE_HOUR_MS
  );

  if (recentHashes.includes(newFileHash)) {
    vscode.window.showInformationMessage(
      `The file "${fileName}" content already exists in the repository.`
    );
    return;
  }

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
