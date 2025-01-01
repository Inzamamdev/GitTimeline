import * as vscode from "vscode";
import { getSavedContent } from "./utils/utils";
import { octokitInstance } from "./utils/utils";
import * as dotenv from "dotenv";

dotenv.config();
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log(process.env.API_KEY);
  const createRepoCommand = vscode.commands.registerCommand(
    "gittimeline.createRepo",
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Enter your GEMINI API key",
        placeHolder: "e.g., abc123",
        ignoreFocusOut: true, // Keeps the input box open even if the user clicks outside
      });

      const credentials = await vscode.authentication.getSession(
        "github",
        ["repo"],
        { createIfNone: false }
      );

      if (!credentials) {
        vscode.window.showErrorMessage(
          "GitHub credentials not found. Please log in to GitHub via VS Code."
        );
        return;
      }

      const token = credentials.accessToken;

      const octokit = await octokitInstance(token);

      const repoName = "code-tracking";
      const user = (await octokit.rest.users.getAuthenticated()).data.login;

      try {
        let repoExists = false;

        try {
          await octokit.rest.repos.get({
            owner: user,
            repo: repoName,
          });
          repoExists = true;
        } catch (err: any) {
          if (err.status !== 404) {
            throw err;
          }
        }

        if (!repoExists) {
          console.log(user, repoName);
          await octokit.rest.repos.createForAuthenticatedUser({
            name: repoName,
            description: "code-tracking description",
            private: false,
          });
          vscode.window
            .showInformationMessage(
              `Repository "${repoName}" created.`,
              "Open Repository"
            )
            .then((selection) => {
              if (selection === "Open Repository") {
                vscode.env.openExternal(
                  vscode.Uri.parse(`https://github.com/${user}/${repoName}`)
                );
              }
            });
        } else {
          console.log(user, repoName);
          vscode.window
            .showInformationMessage(
              `Repository "${repoName}" already exists.`,
              "Open Repository"
            )
            .then((selection) => {
              if (selection === "Open Repository") {
                vscode.env.openExternal(
                  vscode.Uri.parse(`https://github.com/${user}/${repoName}`)
                );
              }
            });
        }

        let debounceTimer: any;

        vscode.workspace.onDidSaveTextDocument(async (document) => {
          const autoSaveSetting = vscode.workspace
            .getConfiguration("files")
            .get("autoSave");

          if (autoSaveSetting && autoSaveSetting !== "off") {
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(async () => {
              getSavedContent(context, document, user, repoName, token, input);
            }, 30 * 60 * 1000);
          } else {
            getSavedContent(context, document, user, repoName, token, input);
          }
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to create or update repository: ${error.message}`
        );
      }
    }
  );

  context.subscriptions.push(createRepoCommand);
}

export function deactivate(): void {}
