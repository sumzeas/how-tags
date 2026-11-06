# Markdown rendering
**As an** Editor
**I need** pages to display markdown
**So that** anyone can create a page with plain text.

### Details and Assumptions
- There needs to be a way to render markdown in the browser

### Acceptance Criteria
```gherkin
Given a page in markdown,
When the page is loaded,
Then it should display valid HTML.
```

# Tag-based filtering
**As** a User
**I need** to filter a page by tags such as programming language or library
**So** that I can precisely narrow my search results without typing in full questions.

### Details and Assumptions
- There are some pages in the database
- There is a UI to input tags

### Acceptance Criteria
```gherkin
Given a page with tags <python, print> exists,
When I input the exact number of tags in any permutation into my search query,
Then I should be redirected to the correct page and view it.
```

```gherkin
Given a page with tags <python, threads> exists,
When I input the incorrect number of tags into my search query,
Then I will NOT be redirected
And receive an error message saying the page does not exist.
```

# Tag Suggestion List
**As a** User
**I need** to see a list of tags as I type
**So that** I can know what tags are available.

### Details and Assumptions
- There are some pages in the database
- There is a UI to input tags
- There is a caching layer to quickly fetch tags

### Acceptance Criteria
```Gherkin
Given the available tags <c, cpp, csharp, clang>,
When I type the letter 'c',
Then an inline drop-down showing <c, cpp, csharp, clang>.
```

```Gherkin
Given the available tags <c, cpp, csharp, clang>,
When I type in 'cl',
Then an inline drop-down showing <clang>.
```

```Gherkin
Given the available tags <c, cpp, csharp, clang>,
When I type the letter 'a',
Then no inline drop-down list should appear.
```

# Greeting Home Page
**As a** User
**I need** a home page explaining the mission and purpose of how-tags
**So that** I can understand what it is.

### Details and Assumptions
- There is a dedicated page for the user auth
- There is a dedicated page for searching

```gherkin
Given the user types in the URL to how-tags,
When they enter it into their browser,
Then they should see a landing page
And can read what how-tags if for
And can read how to contribute
And can navigate to user auth or search.
```
