# **GitTimeline: A Productivity Extension for VS Code**

GitTimeline is a **VS Code extension** designed to help developers track their coding activities seamlessly and effectively. This extension automatically commits changes to a Git repository after every save, summarizing what you worked on and the previous work in a dedicated branch called **`code-tracking`**.

---

## **Features**

- **Automatic Repository Creation**  
  Creates a new GitHub repository named **`code-tracking`** upon activation. Uses the GitHub API for automated setup.

- **Real-Time Code Tracking**  
  Commits a summary of changes automatically to the **`code-tracking`** branch after every save. Tracks both the current and previous work context for a comprehensive log.

- **Open Source Contribution**  
  Designed for transparency and collaboration, making it easy to adapt for individual or team needs.

---

## **Installation**

1. **Install the Extension**  
   Download and install the **GitTimeline** extension from the [VS Code Marketplace](https://marketplace.visualstudio.com).

2. **Activate the Extension**  
   Open the Command Palette in VS Code (**Ctrl+Shift+P** or **Cmd+Shift+P** on macOS) and run the command **`Create Repo`**.

3. **Start Tracking**  
   The extension will create a new GitHub repository named **`code-tracking`** and start committing changes after every save to the **`code-tracking`** branch.
