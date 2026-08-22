# Integration Questionnaire 2 Answers

**1. For the move itself: should the project's history (every past commit) come along, so looking back at old changes still works from the new location — or is a clean copy of just what's there today simpler?**
> Bring the history across — it's already a well-documented record and costs nothing to keep

**2. What should the web address actually be — mertgurgenyatagi.github.io/footydraft/, or /hashtagfootydraft/ to match the current folder name, or something else?**
> /footydraft/ — shorter, and nothing else there is using it

**3. Here's one worth flagging directly: your other site is public on GitHub — not just the finished pages, the whole project folders, docs included. If footydraft's planning documents (the rules doc, this questionnaire process, your answers) move over as-is, they'd be publicly readable too — including the personal note you added at the end of round 1. Keep the planning docs out of what's public, or don't worry about it?**
> Don't worry about it, everything else over there is already out in the open too

**4. For telling players apart behind the scenes: should each browser quietly get an invisible ID the moment it shows up (no login screen, nothing visible — just makes reconnecting reliable), or keep it purely to the name someone types, no hidden ID at all?**
> Give each browser an invisible ID — it's not an account, nobody sees it, it just makes reconnecting work properly

**5. Your other site currently republishes every single project there — all ~15 of them — every time any one of them changes, footydraft included once it's in. Worth fixing so a footydraft change doesn't also redeploy your unrelated projects (and vice versa)?**
> Yes, fix it so each project only rebuilds when its own files change

**6. Every project on your other site uses the same free-tier setup and the same two server locations. Reuse those same defaults for footydraft, or do you want something different?**
> Reuse the same defaults — no reason to differ

**7. On comparing squads: right now, during a draft, you can already flip through everyone's board on tabs. Should “compare squads” be its own separate screen you visit after the draft ends, or are the existing tabs close enough?**
> Just show all squads side by side.

**8. When that comparison screen opens, should it default to showing your squad against something sensible, or start blank and make you pick both sides yourself?**
> All.

**9. For the Turkish translation: should it read casual, like a group chat with friends, or fairly neutral and formal, the way most apps in Turkish are written?**
> Neutral / formal tone

**10. On the spending alert: is a small, obviously-safe default fine (think: the price of a coffee, per month), or do you want to land on the actual number together first?**
> Zero spending. We'll set the amount at like 0.01 USD

**11. You left the live dry-run with friends as “your call” — I'd do it. Question is timing: after just the first format (Free Pick) is real, so problems show up early, or only once every format is done, as one big test at the end?**
> Wait until everything's done, one test at the end

**12. For Free Pick specifically, going first: should everything about it go live together (real picks, real chat, real presence, all at once), or is it fine to bring these across one at a time — say, real picks first, then chat, then presence?**
> All at once

**13. New situation that comes with real lobbies: if someone opens an invite link to a draft that's already in progress (not full, not finished — just already started), what should happen?**
> Let them watch it live — every board is already open to everyone anyway, so there's nothing to hide

**14. And if someone opens an invite link to a lobby that already has its full 5 people?**
> Show a clear “this lobby is full” message

**15. If someone just closes the tab and reopens it a minute later on the same device mid-draft, should that quietly resume where they left off, or is that treated the same as any other drop — bot takes over after the usual 45 seconds regardless?**
> Quietly resume without triggering the bot takeover, for a quick reopen on the same device

**16. Real chat: should a brand-new lobby's chat start completely empty, or carry one small system line (something like “lobby created”) so it doesn't look broken?**
> One small system line — an empty box can look broken, one line doesn't

**17. Now that the bots use their real trained models: should they keep the couple-second thinking pause they have today, or move at whatever speed the real calculation takes (which could be near-instant)?**
> Keep the pause — it's part of what makes it feel like a table of people, not a script

**18. Should I set up a separate practice version of the backend to develop against, or is it fine to build directly against the real (but empty, unused) one?**
> Build directly against the real one — it's free at this scale and one less thing to maintain

**19. Anything about the actual move to your other site that worries you — for instance, something there breaking, or wanting to see a plan before anything actually moves?**
> No concerns, go ahead

**20. Anything else on your mind about any of this before I get moving?**
> I would like for the implementation to be reckless. If issues arise we deal with them.
