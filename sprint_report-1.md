# Sprint 1 Report 
Video Link: 
## What's New (User Facing)
 * Feature 1: User profiles
 * Feature 2: Tag search box UI

## Work Summary (Developer Facing)
Provide a one paragraph synposis of what your team accomplished this sprint. Don't repeat the "What's New" list of features. Instead, help the instructor understand how you went about the work described there, any barriers you overcame, and any significant learnings for your team.
In this sprint we built the base for the website and some basic functionalities of profiles types. I created a user profile class with a privacy-first approach to ensure data storage and access is minimized. The user’s email is stored only as a Hash-Based Message Authentication Code (HMAC) and the password as a scrypt hash. While the majority of the SearchBox UI is user-facing, the component contains a tagList prop for developers to input an array of strings representing the tags from the database/backend.

## Unfinished Work
[Issue #7: Tag-based Filtering](https://github.com/sumzeas/how-tags/issues/7)
[Issue #2: Password Recovery Email](https://github.com/sumzeas/how-tags/issues/2)
[Issue #9: Tag Suggestion List](https://github.com/sumzeas/how-tags/issues/9 )
## Completed Issues/User Stories
Here are links to the issues that we completed in this sprint:
[Issue #3: Basic User Class Implementation](https://github.com/sumzeas/how-tags/issues/3)
[Issue #8: Searchbox UI](https://github.com/sumzeas/how-tags/issues/8)

 ## Incomplete Issues/User Stories
 Here are links to issues we worked on but did not complete in this sprint:
 
 * URL of issue 1: https://github.com/sumzeas/how-tags/issues/4 << Didn’t initially plan to complete this as part of sprint 1 and ran out of time>>
 * URL of issue 2: https://github.com/sumzeas/how-tags/issues/5 << Didn’t initially plan to complete this as part of sprint 1 and ran out of time >>

## Code Files for Review
Please review the following code files, which were actively developed during this sprint, for quality:
* [app/_components/SearchBox](https://github.com/sumzeas/how-tags/tree/777ac4c104083f3ac6486e142677d2c262dee313/app/_components/SearchBox)
* [lib/users](https://github.com/sumzeas/how-tags/tree/777ac4c104083f3ac6486e142677d2c262dee313/lib/users)

## Retrospective Summary
Here's what went well:
  * Finished a basic backend and frontend utility
  * Effective team communication
 
Here's what we'd like to improve:
   * Add missing documentation to code files
   * Spend more time with team discussing the project
   * Refine the user stories and functional requirements
  
Here are changes we plan to implement in the next sprint:
   * 3 set meeting time and dates
   * Create a template for Kanban board issues
