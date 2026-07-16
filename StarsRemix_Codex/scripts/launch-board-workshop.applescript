on run
  set projectPath to "/Users/bretttaylor/Documents/GitHub/JSProjects/StarsRemix_Codex"
  set workshopURL to "http://127.0.0.1:5173/editor.html"
  set healthCommand to "/usr/bin/curl -fsS " & quoted form of workshopURL & " | /usr/bin/grep -q " & quoted form of "Board Workshop"

  try
    do shell script healthCommand
  on error
    set launchCommand to "cd " & quoted form of projectPath & " && nohup npm run dev </dev/null >/tmp/starsremix-board-workshop.log 2>&1 &"
    do shell script "/bin/zsh -lc " & quoted form of launchCommand

    set serverIsReady to false
    repeat 50 times
      delay 0.1
      try
        do shell script healthCommand
        set serverIsReady to true
        exit repeat
      end try
    end repeat

    if serverIsReady is false then
      display dialog "Board Workshop could not start. Details are in /tmp/starsremix-board-workshop.log." buttons {"OK"} default button "OK" with icon stop
      return
    end if
  end try

  open location workshopURL
end run
