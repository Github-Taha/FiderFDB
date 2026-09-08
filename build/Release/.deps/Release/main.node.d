cmd_Release/main.node := ln -f "Release/obj.target/main.node" "Release/main.node" 2>/dev/null || (rm -rf "Release/main.node" && cp -af "Release/obj.target/main.node" "Release/main.node")
