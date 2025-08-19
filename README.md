# Claude code GUI
### Technology stack
1. For conmmunicating withing server and client: I build a server my self ,using websocket,as you see in server.js,the working dictionary changing, client communicating and mcp installing, are all finished by this file
2. For mcp installing: I use ther separeted files: server.js, mcp-manager.js and server_new_api.js,except mcp-manager.js, the other two files are all used to run install commands using spwan. the mcp-manager.js, are used for showning the installation of MCP servers.I also put some common MCP, convient for you to use.
3. For communicationg withing claude code and client: I use the claudeSDK, which is published by anthropic, than I filitered some of the useless informations, and shown as blocks or text, all the logical part is script.js. Now, these are shown on the page: Tools for edit, write and Multiedit,MCP use ,read files, web searching. 
### Functions
* Talk with claude, filetered feedback will be shown on the page
* installing MCP
* Learn to authocate if the Mcp need to, It will be shown clearly on the page, you can click the buttons to look how to authocate or close it
* chage dark/bright mode
* The grettings will change according to the time
* upload pictures and tell claude code to think harder by using buttons
* see how many tokens are used in this problem
### Future functions
* See how many requests you use for weekly or monthly
* genarate CLAUDE.md by your self use markdown editer or by AI
* Create youe own agent and use them any time you like, by changing CLAUDE.md automatically
* feedback in feedback unit
### How to use?
easily, just download the code and:


`cd ~/claude-code-GUI`


after getting into the project,please run:


`node server.js`


if installationg failed, please download node.js on website:[node.js download](https://nodejs.org/en)


than, open your broswer and enter:http://localhost:8080/
For better expierence, please allow all the premission, I can promise it is safe
### postscript
Wish you like my project! If there are any problem or bug, please upload an issue, or contect me with junqi_mike@outlook.com Thanks for reading
