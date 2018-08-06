"use strict"

const _ = require('lodash')
const chai = require('chai')
const expect = chai.expect
const SprintlyToJira = require('././lib/SprintlyToJira')
const url = require('url')
const URL = url.URL

// map Sprint.ly values on left to JIRA values on Right
const userMap = {
  "employee@rideamigos.com"        : "employee",
  "ex.employee@rideamigos.com"     : null,

};

// Map Sprint.ly project numbers on left to JIRA on the right.
// Used for translating Sprint.ly links to JIRA links, even when then cross queues.
// So this mapping should be complete even if you are only importing one queue at a time.
const projectMap = {
  12345  : "DEMO",
  11122  : "UFS",
  22233  : "ASTRO",
};


// Example constructor to migrate a single queue.
const s2j = new SprintlyToJira({

  // To support incremental and partial imports.
  firstTicketNum: 1,
  lastTicketNum: 1,

  sprintlyProjectNum: 11122, // UFS
  jiraProjectKey: "UFS", // For testing
  jiraBaseUrl: 'https://yourcorp.atlassian.net',

  // Special proxy temporarily makes Sprint.ly attachments publicly accessible
  // To JIRA during import by authenticating requests during the proxy.
  fileProxyBaseUrl: 'http://sprintlyfiles.yourcorp.com/somesecret',

  // Map Sprint.ly emails to JIRA user names:
  userMap,
  // Map Sprint.ly project names to JIRA project keys
  projectMap,

  maxLabels: 10,
  maxComments: 50,
  maxAttachments: 20,

  // For testing, map child item 2 to parent item 2
  ticketParentMap: {
    2: 1,
  }
});


describe("SprintlyToJira", () => {
  xdescribe("jiraBaseUrl (not used)", () => {
    it("should be set to our value", () => {
      expect(s2j.jiraBaseUrl).to.equal("https://yourcorp.atlassian.net");
    });
  });

  const expectedRowLength = 12+50+10+20

  describe("csvHeaderRow", () => {
    it("should have expected length", () => {
      const row = s2j.csvHeaderRow;
      expect(row).to.have.length(expectedRowLength);
    })
  });

  describe("transformAllItemsToCSVArray", () => {

    const newArray = s2j.transformAllItemsToCSVArray([
      {
        number: 123,
        created_by: { email: 'employee@rideamigos.com', },
        assigned_to: { email: 'employee@rideamigos.com', },
        description: "Hello",
				status: "completed",
        labels: [],
        comments: [],
        attachments: [],
      },
      {
        number: 456,
        created_by: { email: 'employee@rideamigos.com', },
        // Un-assigned items are assigned to null,
        assigned_to: null,
        description: "Hello",
				status: "accepted",
        labels: [],
        comments: [],
        attachments: [],
      }
    ]);

    it("Should have expected structure", () => {
      // These are not valid items, but are sufficient for this test.
      expect(newArray).to.have.length(3);
      expect(newArray[0][0]).to.equal("Issue Key")
    });
    it("should have expected data row length", () => {
      expect(newArray[1]).to.length(expectedRowLength);
    });
    it("should reality-check JIRA Issue key value", () => {
      expect(newArray[1][0]).to.equal("UFS-123")
    });
    it("should reality-check Resolution for completed and accepted status", () => {
      expect(newArray[1][11]).to.equal(undefined)
      expect(newArray[2][11]).to.equal("Done")
    });

  });

  describe("transformItemComments", () => {
    it("should transform valid comments", () => {
      const validSprintlyComments = [
        {
          "body": "Here is an [example](https://sprint.ly/product/11122/item/1234)",
          "type": "commit",
          "id": 400,
          "created_by": {
            "first_name": "employee", "last_name": "Stosberg",
            "id": 1, "email": "employee@rideamigos.com"
          }
        },
        {
          "body": "Hello World.",
          "type": "commit",
          "id": 445,
          "created_by": {
            "first_name": "employee", "last_name": "Stosberg",
            "id": 1, "email": "employee@rideamigos.com"
          }
        }
      ];

      expect(s2j.transformItemComments(validSprintlyComments)).to.eql([
        '2018-07-01T00:00:00+00:00; employee; Here is an [example|https://yourcorp.atlassian.net/browse/UFS-1234]',
        '2018-07-01T00:00:00+00:00; employee; Hello World.',
      ]);
    });
  })


  describe("transformItemAttachments", () => {
    // Requires your own valid Sprint.ly Attachment URLs to work.
    xit("should transform valid attachments", async () => {
      const validSprintlyAttachments = [
        { "href": "https://sprint.ly/product/12345/file/220094" },
        { "href": "https://sprint.ly/product/12345/file/137135" }
      ];
      const [ firstUrl, secondUrl ] = await s2j.transformItemAttachments(validSprintlyAttachments)

      const firstUrlParsed = new URL(firstUrl);
      expect(firstUrlParsed.origin).to.equal("https://item-attachments-production.s3.amazonaws.com")
      expect(firstUrlParsed.pathname).to.equal("/69/9501a0c5f511e2a438476dbf08873d/some-file.png")

      const secondUrlParsed = new URL(firstUrl);
      expect(secondUrlParsed.origin).to.equal("https://item-attachments-production.s3.amazonaws.com")
      expect(secondUrlParsed.pathname).to.equal("/69/9501a0c5f511e2a438476dbf08873d/some-file.png")
    })
  })

  describe("transformMarkdown", () => {
    it("should return through basic text unchanged", () => {
      expect(s2j.transformMarkdown("Hello World")).to.equal("Hello World");
    });

    it("should convert a markdown link to Unity item to JIRA notation.", () => {
      const desc = "Here is an [example](https://sprint.ly/product/11122/item/1234)"
      expect(s2j.transformMarkdown(desc))
        .to.equal("Here is an [example|https://yourcorp.atlassian.net/browse/UFS-1234]");
    });

    it("should convert a markdown link to DevOps item to JIRA notation.", () => {
      const desc = "Here is an [example](https://sprint.ly/product/12345/item/23)"
      expect(s2j.transformMarkdown(desc))
        .to.equal("Here is an [example|https://yourcorp.atlassian.net/browse/DEMO-23]");
    });

    it("should convert a markdown link to Astro item to JIRA notation.", () => {
      const desc = "Here is an [example](https://sprint.ly/product/22233/item/45)"
      expect(s2j.transformMarkdown(desc))
        .to.equal("Here is an [example|https://yourcorp.atlassian.net/browse/ASTRO-45]");
    })

    it("should link #123 as a Unity issue in JIRA", () => {
      const desc = "Fixed thing. Ref: #123 some text after this"
      expect(s2j.transformMarkdown(desc))
        .to.equal("Fixed thing. Ref: [#123|https://yourcorp.atlassian.net/browse/UFS-123] "
                  +"some text after this");
    })

    it("should not double link", () => {
      const desc = "before [#123|https://yourcorp.atlassian.net/browse/UFS-123] after"
      expect(s2j.transformMarkdown(desc))
        .to.equal("before [#123|https://yourcorp.atlassian.net/browse/UFS-123] after");
    })
  })

  describe("transformItem", () => {
      // From: https://support.sprint.ly/hc/en-us/articles/213642287-Items
      const validSprintlyItem = {
        "status": "backlog",
        "created_at": "2013-06-14T22:52:07+00:00",
        "last_modified": "2013-06-14T21:53:43+00:00",
        "product": {
            "archived": false,
            "id": 1,
            "name": "sprint.ly"
        },
        "progress": {
            "accepted_at": "2013-06-14T22:52:07+00:00",
            "closed_at": "2013-06-14T21:53:43+00:00",
            "started_at": "2013-06-14T21:50:36+00:00"
        },
        "description": "Require people to estimate the score of an item before they can start working on it.",
        "tags": [
            "scoring",
            "backlog"
        ],
        "number": 188,
        "archived": false,
        "title": "Don't let un-scored items out of the backlog.",
        "created_by": {
            "first_name": "Mark Stosberg",
            "last_name": "Stosberg",
            "id": 1,
            "email": "employee@rideamigos.com"
        },
        "score": "M",
        "sort": 1,
        "assigned_to": {
            "first_name": "Mark Stosberg",
            "last_name": "Stosberg",
            "id": 1,
            "email": "employee@rideamigos.com"
        },
        "type": "task"
      };

    it("should return JIRA issue structure for known-user case", () => {
      const jiraIssue = s2j.transformItem(validSprintlyItem)
      expect(jiraIssue).to.eql({
          "Date Created":  "2013-06-14T22:52:07+00:00",
          "Date Modified": "2013-06-14T21:53:43+00:00",
          "Issue Id": 188,
          "Parent Id": undefined,
          "Issue Key": "UFS-188",
          "Summary": "Don't let un-scored items out of the backlog.",
          "Issue Type":  "Task",
          "Assignee": 'employee',
          "Reporter": 'employee',
          "labels": ["scoring","backlog"],
          "Description": "Require people to estimate the score of an item before they can start working on it.",
          "Status": "backlog",
          "attachments": undefined,
          "comments": undefined,
      })
    })


    it("should set Issue Type to Sub-Task for if parent issue is found.", () => {
      const childItem = _.cloneDeep(validSprintlyItem);
      // Set a number to match a child in ticketParentMap
      childItem.number = 2;

      const jiraIssue = s2j.transformItem(childItem)

      expect(jiraIssue).to.eql({
          "Date Created":  "2013-06-14T22:52:07+00:00",
          "Date Modified": "2013-06-14T21:53:43+00:00",
          "Issue Id": 2,
          "Parent Id": 1,
          "Issue Key": "UFS-2",
          "Summary": "Don't let un-scored items out of the backlog.",
          "Issue Type":  "Sub-Task",
          "Assignee": 'employee',
          "Reporter": 'employee',
          "labels": ["scoring","backlog"],
          "Description": "Require people to estimate the score of an item before they can start working on it.",
          "Status": "backlog",
          "attachments": undefined,
          "comments": undefined,
      })
    })



    it("should set users to null for known ex-employees.", () => {
      const exEmployeeItem = validSprintlyItem;
      exEmployeeItem.created_by  = {
        first_name: "Ex",
        last_name: "Employee",
        id: 2,
        email: "ex.employee@rideamigos.com",
      };
      exEmployeeItem.assigned_to  = exEmployeeItem.created_by;

          const jiraIssue = s2j.transformItem(exEmployeeItem)
          expect(jiraIssue).to.eql({
              "Assignee": null,
              "Reporter": null,
              "Date Created":  "2013-06-14T22:52:07+00:00",
              "Date Modified": "2013-06-14T21:53:43+00:00",
              "Issue Id": 188,
              "Parent Id": undefined,
              "Issue Key": "UFS-188",
              "Summary": "Don't let un-scored items out of the backlog.",
              "Issue Type":  "Task",
              "labels": ["scoring","backlog"],
              "Description": "Require people to estimate the score of an item before they can start working on it.",
              "Status": "backlog",
              "attachments": undefined,
              "comments": undefined,
          })
        })

    it("should throw if we failed to map a user (rather than silent failure)", () => {
      const nonEmployeeItem = validSprintlyItem;
      nonEmployeeItem.created_by  = {
        first_name: "Forgotten",
        last_name: "Bob",
        id: 2,
        email: "forgot.bob@rideamigos.com",
      };
      nonEmployeeItem.assigned_to  = nonEmployeeItem.created_by;

      expect(() =>s2j.transformItem(nonEmployeeItem)).to.throw;
    })
  }) // transformItem
})
