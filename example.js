//"use strict";
const SprintlyToJira = require('./lib/SprintlyToJira');


// Example Use.

// map Sprint.ly values on left to JIRA values on Right
const userMap = {
  "username@example.com"              : "username",
};

// The JIRA project key actively being imported. Must be in projectMap below.
// Also set sprintlyProjectNum below to match!
const projectKey = 'DEMO'

// Map Sprint.ly project numbers on left to JIRA on the right.
// Used for translating Sprint.ly links to JIRA links, even when then cross queues.
// So this mapping should be complete even if you are only importing one queue at a time.
const projectMap = {
  12345  : "DEMO",
};


// Example constructor to migrate a single queue.
const migrator = new SprintlyToJira({

  sprintlyProjectNum: 12345, // DEMO
  jiraProjectKey: projectKey,
  jiraBaseUrl: 'https://yourcorpname.atlassian.net',

  // Special proxy temporarily makes Sprint.ly attachments publicly accessible
  // To JIRA during import by authenticating requests during the proxy.
  fileProxyBaseUrl: 'http://sprintlyfiles.yourcorp.com/somesecret',

  // Map Sprint.ly emails to JIRA user names:
  userMap,
  // Map Sprint.ly project names to JIRA project keys
  projectMap,

  // In the JIRA CSV format, we have to have one column per tag, comment, and attachment.
  // We allocate a number of columns for each that is expected to exceed the maximum amount
  // used. We'll throw if this assumption is wrong.
  maxLabels: 20,
  maxComments: 500, // If you have Git integration, every related commit counts as a comment, too!
  maxAttachments: 40,

});

migrator.exportSprintlyToJiraCSV();
