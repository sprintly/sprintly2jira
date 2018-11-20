# sprintly2jira -- A Sprint.ly to JIRA export/import tool.

Maximally exports Sprint.ly data for a project into  a CSV file that can be used to import
the data into a JIRA project.

## Features

The following conversions are handled:

  * JIRA Issue Keys correspond to Sprint.ly item IDs.
  * Sub-tasks
  * Item comments
  * Item attachments
  * Markdown to JIRA syntax
  * Sprint.ly link to JIRA links for the project
  * cross-links to other Sprint.ly projects to related JIRA projects
  * Issue Type conversion
  * Assignee
  * Reporter
  * Tags
  * Status="accepted" adds Resolution=Done in JIRA

## Limitations

 * The current design builds the entire export CSV in memory. This has been tested to work
without about 5,000 items to export. With a sufficiently large export set, you could run out of
memory. Your own your own to update the design in this case.
 * Sprint.ly does not export the comment creation time, so all comments will appear to happen
   on 2018-07-01 (arbitrarily)

## Installing

You can install from npm with:

```
npm install -g sprintly2jira
```

## Usage

An example use is shown below.

Make sure you address the steps noted in the Preparations section below before
running your export.

The result will be a CSV file in the current directory that can be imported into JIRA.

```javascript
const SprintlyToJira = require('sprintly2jira');

// Example Use.

// map Sprint.ly values on left to JIRA values on Right
const userMap = {
  "username@example.com"              : "username",
};

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
  // The JIRA project key actively being imported. Must be in projectMap above.
  // Must correspond to sprintlyProjectNum
  jiraProjectKey: 'DEMO',
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
```

## Preparing

### Authentication

Collect your Sprint.ly email and API Keys and set them in the environment.

```
   SPRINTLY\_EMAIL
   SPRINTLY\_API\_KEY
```

Alternately, you can get them in `process.env.SPRINTLY_EMAIL`
and `process.env.SPRINTLY_API_KEY` in your export script.

### Handling Attachments

The JIRA CSV importer allows importing attachments by providing URLs that
accessible to JIRA.  Sprint.ly's attachments usually require cookie
authentication from being logged into the cookie website.

The solution used here is to setup an Nginx proxy at a hidden URL which expects
requests to match the same structure as Sprint.ly. The proxy then rewrites the request and
redirects the request on to Sprint.ly with authentication.

Sprint.ly in turn will return a  public URL to the assest in S3 that expires
after 4 hours. This should be enough time to import the CSV file into JIRA.

See [./nginx-sprintly-proxy.conf](./nginx-sprintly-proxy.conf) for an example proxy configuration.

## Mapping Sprint.ly users to JIRA users

You need to build a map of Sprint.ly user names to JIRA usernames.

Here's a start, using curl and JQ:

```
curl  --user "$JIRA_EMAIL:$JIRA_API_KEY"  --header 'Accept: application/json'  --url 'https://rideamigos.atlassian.net/rest/api/2/user/assignable/multiProjectSearch?projectKeys=UFS'   | jq '.[] | {(.emailAddress): .name}'
```

### Formatting Dates

Once you importing your file into JIRA, you'll be asked to provide a date format. The date format to use is:

   "yyyy-MM-dd'T'HH:mm:ssX"


