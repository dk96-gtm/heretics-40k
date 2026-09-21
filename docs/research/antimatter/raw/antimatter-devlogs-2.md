===== [2026-02-09] Roadmap to Demo V =====
Demo 4 ends now, time for the Demo 5 roadmap.
Many of you have generously invested time in improving the game through bug reports and feedback on Discord and Steam, thanks a lot!


Stability & Bug Extermination
Demo V4 significantly shook the simulation, but the next round (Demo 5) will introduce fewer bold changes to the core systems, allowing things to settle for a while, at least until the next bugpocalypse ☢️

Colonization and AI (Outposts)

 Colonization decisions and AI missions for outposts.
 Improved outpost build order logic.
 Smoother outpost creation flow for the player, with a tutorial covering outpost creation and management.

Note: Outposts in Antimatter are proto-colonies. They host industrial facilities and a population considered as employees. These employees require wages but satisfy their needs independently. All industries in an outpost are owned by the founding organisation, and production goes directly into its inventory (In colonies, production is first handled by wholesalers)

Passenger Transport & Migrations
Interplanetary migrations will be enabled in this version. In addition to goods transport, you will also see transport ships carrying colonists and, eventually, tourists.

Improved Accrete Model

 Improved ringed-planet simulation.
 Planetary geology (radiogenic, resonance, primordial), plus volcanic and magnetic activity.
 Late asteroid bombardment.


Terraformation
(Terraformation was disabled for Demo 4)

 Improved terraformation UI, allowing you to see predicted effects on the atmosphere and the planet’s surface
 Rebalanced outpost modules (used to produce terraforming capacity to change atmospheric composition and control biosphere)


Mining & Ore

 Increased scarcity and greater variation of ores based on planetary geologic history.
 Ore depletion with surface vs deep mining: a sharp distinction between easily accessible but limited surface deposits, and effectively infinite deep deposits that become increasingly difficult to exploit
 Improved UI for player mining actions
 Improved UI for mining industry production lines


Improved Planet Look & Features

 Improved relief tiles
 Volcano tiles
 Improved visuals for cities, development, and roads
 Visual representation of ore presence
 More tiles and textures for biomes
 Impact crater visuals and representation


Specimen System (New Feature)
A specimen is a codex/tech entry indicating that a lifeform has been fully studied.
A specimen must be studied before it can be used as a “recipe” in industry and agriculture. It is also required for lifeform introduction during terraformation.
A specimen can only be studied if local habitability is very high. You will need to find the right planet and the right region to carry out this study.

Improved Planisphere UI
Quality-of-life improvements, better feedback, and increased stability

===== [2026-02-06] Demo 4 is Live =====
This update took slightly longer than initially planned, but more work was done too.
Demo 4 is as usual, an alpha test round to hunt bugs and test new features. 
It will be available for the duration of the week-end.



Revised starting options

Starting...

 Spacecraft + the possibility to toggle as private property / allocated asset
 Wingmen (fleet)
 Cash (or debt)
 Influence in the organization
 Rank in the organization
 Allocated points are now computed differently and condition the possibility to get Steam achievements (although there are no achievements yet!)


Revised ship modules + designer + new modules

(Modules are weapons, cargo storage, thrusters, etc...)

 Characteristics are bound by modifiers rather than manual raw values. Variants for all sizes are generated as well.
 Every single module in the game has been balanced and granted new rules and characteristics.
 Added multiple modules and removed some.


Revised ship editor (dev/modder only)


 More robust and complete ship designer
 Preliminary work for an in-game ship designer available for organizations


Revised influence border


 Overhauled the border and territory rendering (more accurate and faster)
 Better evolution of system control and arbitration of ownership


Tweaked scenario


 Replicants faction extended
 Alpha Centauri is colonized by the SAE
 Something lurks in deep space...


Improved generation

General improvement to generating minor organizations.

Organization AI: Military


 Better theatre creation and allocation logic
 Much better fleet AI decision-making
 Improved police, operatives, and explorer AI and allocation


Organization AI: Economy


 Shipyard orders, with a simulated local (faction) and global market
 Better simulation of spacecraft demand
 Cargo, miners, and passenger transport target ship counts (AI and player)
 Value-added taxes, which replace profit taxes


Industry

(for outposts, colonies, and stations)

 Simplified how industries are built and capped for space-station-based industries
 Industry retooling: allows switching to a compatible industry type (currently free)


Revised diplomacy & war


 Improved most diplomacy and war logic
 Improved UI with sorting options, tooltips, and additional information


Improved fleet management


 Revised UI with many small features and QoL improvements
 Possibility to edit templates from the fleet screen
 Fleet formation
 Support for parasites
 Formation posture


Smart cursor & improved ship orders

When giving ship orders (tasks)

 Proposes a task given the context: Attack, Join Fleet, Dock/Land, Salvage wreck
 "Alt key" to switch the smart cursor to multiple options (context menu) instead of smart orders
 The player's ship can be given AI orders
 Extended AI order (task) options
 Possibility to queue tasks (hold Shift while giving orders)
 Better UI feedback for orders (barks, tooltips, descriptions, queued travel lines, etc...)


...Hundreds of fixes, tweaks, performance improvements, and small additions

===== [2025-11-29] Demo III ends - Roadmap to Demo IV =====
This cycle has ended. Thank you to all the testers who reported bugs and shared suggestions to help improve the game.

The next version will be released within two months. Here is a roadmap of the new features planned for Demo IV.

New Starting Options
In the next version, you will be able to customise your start: choose your starting spaceship and its loadout, set your initial funds (or debt), define your influence and rank within your organisation, and force up to four captains to volunteer with your shenanigans.

Work in Progress

New Scenario
The current, very basic scenario will be replaced by a larger and more dynamic playground that showcases more of what Antimatter is meant to be: a 4X. As usual, additional tutorial missions will be added, and the existing ones will be polished to help you discover the game’s mechanics.

A conceptual sketch of the next scenario.

Hyperdrive
If you have played the game, you have probably already noticed how a star’s gravity well affects hyperdrive efficiency; hyperspace travel becomes significantly less effective as you approach a massive star.

I will be adding a new type of drive designed specifically for long-distance interstellar travel. It offers a much higher nominal acceleration, but it is also far more vulnerable to the effects of gravity wells.
You will need to choose carefully when selecting the drive of a spacecraft:
should it excel at defensive quick-response roles and efficient local trade, or should it prioritise long-range force projection and extended trade routes?
It took almost a month to reach Alpha Centauri.

Carriers and AI Orders
The hyperdrive changes and interstellar travel will make carriers and parasite-craft management a priority for revision, as these vessels will become valuable assets for any expeditionary force.

I will also conduct a general UI pass to enable, organise, and improve as many AI command features as possible. The goal is to make control feel as smooth as in a classic RTS, while preserving the complexity of the game, a delicate task.

Organization AI and System Control
With two major factions at war, I will be putting the strategic AI and theatre system to the test. I will also work on improving the visualisation of territorial control and providing clearer feedback on your faction’s AI decisions.


Taxes & Basic Dynamic Diplomacy
Most corporations in Sol and Alpha Centauri operate under the authority of the SAE. They pay a share of their income, but otherwise have free rein in their commercial activities. However, this arrangement may change if the perceived balance of power in the region shifts toward another faction.Flarfir pays a form of tax here depicted as a "tribute"

Since the economy accurately tracks value added across all industries, I will also introduce a value-added tax. This provides a far more efficient and reliable method of taxation than profit tax, which it will replace.

Debugging and Program Architecture
Last, but certainly not least, I will focus on debugging. I also expect this development cycle to be primarily centred on further improving the program architecture rather than the features described above. I anticipate completing this architecture overhaul within three to four months, which will in turn free up more time to work on the fun content to you.

===== [2025-11-22] Update B0019 =====
PS: Huge thanks to the testers!

Build 0019
Minor update, tweaks and fixes.


 - Fixed: the mission (Initiation) Food delivery was not working
Mission PoV was not set to "spaceship" causing "CargoHold" trigger to check upon character's inventory.

 - Tweaked (UI): tooltips with keybindings for timescale buttons

 - Tweaked (scenario): added 2 new cargo ship types for sale and for allocation

 - Tweak (UI): Ship's tooltip now shows private property info

 - Fixed (UI): Quick search menu has more complete and robust sorting system

 - Tweaked (UI): Added a button to the Universal Search menu located on the HUD

 - Fixed: 'dock-at' / 'travel to' etc. functions not showing up when the target is already the primary selection

 - Fixed: Camera control with keyboard was time scale dependant - Also more robust camera keybindings

 - Tweaked: Inventory no longer shows items with tiny stock (< 0.01)

 - Fixed/Tweaked: An asset with a negative net worth (such as indebted ones) can no longer be attributed/deattributed

 - Fixed: 'Replace with' in equipment dock was showing all module sizes

 - Fixed: Actions on spaceship's hardpoints is now only possible for the direct controller / editor mode

 - Fixed: Indebted stations could not buy player's good in some situations

 - Fixed/Code quality: Overhauled 'trade out' logic + allow 'sell/buy as much' function

 - Fixed: Manual trade not showing why a trade cannot be performed

 - Small Revision: Character traits / Character creation UI :
-Fixed: All education traits have now education level requirements
-Fixed: some requirements -criteria were not working
-Fixed: Localization for 'Galactic lore' skill
-Fixed: Trait category localization
-Tweaked (UI): Traits is the character creation UI are now sorted by sub category + alphabetically
-Tweaked (UI): Subcategory have an assigned color and is displayed in the character creation UI
-Fixed(UI): Trait's tooltip text overflow
-Fixed: Attributes in the character creation was conflicting with bonus from traits
-Tweaked (UI): Order of attributes in the UI is now consisent with order in the character sheet.
-Tweaked: Character creation UI start with a randomly generated character
-Fixed: Misaligned UI element in character customization window in ultra-wide resolutions
-Tweaked: Better gen for character without a birthplace
-Tweaked: Better generation of base skill for non-archetype characters

 - Tweaked: Better and more descriptions in the tutorial missions

 - Fixed: Character's DNA customized in character creation did not persist

===== [2025-11-21] Demo III - Testing Is Now Open ! =====
If your life hasn't yet been sucked dry by the recent release of EUV, it is time for a new testing round with Antimatter.

DEMO III will be available for a week, until the 28th of November, included.

[url=https://steamcommunity.com/games/1343010/announcements/detail/631194514248171623]Read about the devlog here.

I maintain the quick-iteration approach, getting the game beaten and tortured in all possible manners has tremendously benefited my productivity in making the game better. Slowly, but surely.
It has, and will, disappoint many with its raw state. Many will bounce and never look back, but I needed the feedback, and a good game is not created out of orchestrated hype and marketing, so let's carry on.

Demo III addresses many bugs and unlocks many of the latent features and expands them, while trimming the fat where it is necessary.
Enjoy (or don't) the new version. I read all feedback with great attention, but please keep emotions in the locker ;)

Be advised this is a non-exhaustive (in-game) changelog. Too much has changed or been revised to enumerate everything, and I am not paid by resolved ticket count.

Also, as a last-minute change, I have decided to have an additional dev pass on the boarding mechanics, so the close combat system will have a rather unfriendly UI for now. You will still be able to fulfill the initiation mission where you need to capture someone, though. Just blow up his ship and capture him.

===== [2025-11-16] Demo III coming soon ! =====
Demo III will be released in a few days, on the 21st of November.
Here are some highlights:

The Dynamic Economy

With extensive work done on the production and trade simulation, the economy now feels much more alive, with trade ships, miners, and bustling factories.

The War Machine

A fully self-sufficient supply chain for spacecraft production has been successfully tested over multiple years of in-game simulation.

For Charts Lovers

Charts have been greatly improved, along with detailed accounting across all organizations.

Outposts & Space Stations

Outposts and productive space stations have been revised with new features and major UI improvements.

Production Methods

Production lines can now use multiple recipes to choose from, ranging from primitive methods to advanced ones requiring complex supply chains.

Landing on Planets


The landing UI has been redesigned, alongside new and refined features.
Landing in difficult terrain can now be impossible under certain conditions, forcing you to complete the journey on foot.

Planet Survey

Planet surveying has been improved, both in UI and mechanics.
Basic topographic information is easy to obtain, but uncovering detailed data now requires much more time.

Shipyard UI

A centralized interface now allows you to order spacecraft across all available shipyards.


New construction orders are automatically distributed among production lines with the smallest queue.

Two New Tutorials + Boarding

Two new tutorials are included: one to learn the basics of trading, and another where you must hunt down and capture a target, introducing the close-combat and boarding mechanics.

System Requirements: A Computer

Continuous optimization, especially the work on the background saving system, has led to efficient and tightly managed memory usage.
CPU and RAM requirements are now even lower than before.




Tons of Bug Fixes, Tweaks, and Improvements
Last but certainly not least, this version is far more stable and feature-rich than the previous one.
Arguably, the biggest effort lies not in what is showcased here, but in the overall refinement of the game.
The “4X as a character” aspect is now much clearer in this version, the separation of private assets and money to what is owned by the organization is an aspect that has been refined as well.

I also went through all reported bugs on Discord and fixed most of them. Due to the amount of fixed unreported and reported bugs, I will not list them in the changelog.

===== [2025-10-02] Demo II Wrap-Up & Roadmap to Demo III =====
Thank you to all the testers who provided feedback for this second version of the demo. Many of you submitted detailed bug reports and suggestions, and I’ll be working on all of them.

The game is getting better, and features are slowly but surely being consolidated thanks to your feedback.

Demo II ends today, so it is time to lay out the roadmap for Demo III, which will be released within 2 months.

DEMO III ROADMAP

Fixing bugs
Thanks to the large number of reports (mainly on Discord), I have a lot on my plate for this dev cycle. I’ll prioritize this.

Revise landing on planets and asteroids
This will be deeply reworked, both in the UI and in the mechanics.

Revise planet orbital survey
With improved UI, better mechanics, and balancing of the feature.

Revise close combat
Crew vs. crew combat will be reworked to its final version, featuring improved boarding operations, but also special ops options and combat during encounters while traveling on the planet surface (expeditions).

Revise shipyards
Improvements with a dedicated UI and consolidated mechanics.

Revise ground expeditions
Overhauling the UI and consolidating the feature into a stable state with meaningful content.

Revise planet surface (planisphere)
A UI pass, optimizations, fixes for known issues, and the addition of overlays.

Simulated economy
The scenario will start with a richer economy, providing more trade and production opportunities for both the AI and the player. The economy in Antimatter is fully simulated, but in its current state it can feel too “cold.”

Additional tutorial missions
The tutorials introduced in Demo II proved useful in teaching some basic features. The next demo will feature at least two additional missions in the tutorial “questline,” introducing you to two more consolidated features of the game.

See you soon.

===== [2025-09-27] DEMO II is Live + Tutorial =====
DEMO V2.0 is now live, through the 2nd of october.
As noted in the in-game greeting message: take heed, this is an alpha!
This is aimed at collecting feedbacks.

Here posting again the video detailing this update.


I have also released a new tutorial, teaching you how to use your influence to allocate assets :


And if you have missed it, there is also this tutorial teaching the basics of navigation:


Patch note:

B0016
Release date: 27-09-2025
DEMO 2 candidate #3 - Minor update

Fixed (Scenario): Spawned spaceshipd had their AI disabled

Overhauled fleet roster assignement
-It is no longer possible to assign non-attributed ship to fleet for a fraction of influence cost. Only attributed ship can be assigned.
-QoL: Adding fleet roster is now refined to show only 1.what can be added no at no influence cost (attributed assets) and also 2.assets that can be allocated + added to the fleet.
It also shows more infos (control type, ship type, cost in influence)

Fixed: Deallocation of spaceship now remove her from current fleet

Fixed: Spaceobject crew index error causing crew to not be associated to the object
This caused a bug (among many potential ones) where escaped pod did not expire after having its crew recovered.

----------------------------------------

B0015
Release date: 27-09-2025
DEMO 2 candidate #2 - Minor update

Fixed: An asset on sale can no longer be attributed

Overhauled how spacecraft are bought and sold
Any assets, including spaceships and station can be reliably bought and sold, more conditions were added for acquisitions and exchanges. Many fixes and safeguard added, tooltips, failure feedbacks etc...
Selling assets is now governed by action points when performed on behalf of an organization, as it is considered a political action

Fixed: An allocated spaceship will now leave her current fleet

Fixed: 'Board & take control' (spaceship) was not working in some specific situations

Fixed (Planisphere): Wrong size of unexplored tiles causing visual glitches

UI: Planisphere/Galaxy PoV switches are moved to the bottom menu

Fixed: Planisphere view could crash

Fixed: Erratic tile selection in the planisphere

Fixed UI: Resized docked spaceship list in ship view and fixed an issue preventing mouse interaction with it

UI: Added an overlay indicating when (and why) the weapon system is disabled (hyperdrive)

Organization: AI refactored to ECS with Burst-based parallelism

Fixed: Performance issue on new day (planet populations migrations)

Fixed UI mismatch on mission details button

Tweaked scenario: Added more ships to be allocated

Fixed: Lua Script mission trigger was not working

Tweaked the greeting message to make even more clear this is an alpha

----------------------------------------

B0014
Release date: 24-09-2025
DEMO 2 candidate - Focusing on accessibility, UI, immersion, missions, space station building, richer scenario, code architecture and bugfixes.

Overhauled Action Menus
-Single system for both party action and ship actions
-Removed 'current action' window (streamlined with rework action)
-Removed party effects (will be replaced)
-Scavenging, surveying and timed action are more reliable
-Actions have now a progress bar, a tooltip with localized name and description, a duration, repeatable trigger, a loading loop, a nitication call option, a pause game option
-Much more performant code overall
-Extended action moddability
-Improved scavenging mechanisms

UI Revamp - System view, Planet View, Galaxy View

Added: Zoom to mouse

Universal Search UI
Accessible with Left CTRL+F

UI: Offscreen indicator
For current target and up to 3 tracked missions

Overhaul of Disruptor missiles and added features
AI added, added default loadout system, and many other related mechanisms - Disruptor are fast, long-range missiles capable of turning-off the hyperdrive of the target.

Fixed: Can no longer modify spaceship's doctrine that are not under control

Fixed: Selecting then deselecting a spacecraft was messing with its AI

Added possibility to transfer crew members

Tweaked (Modding): All Enums literals are now exposed in Lua

Reworked codex - better perfomance, no dynamic codexes

UI: Character sheet overhaul

UI/Feature: Added game settings
-Resolution selection
-Keymapping
-Music volume
-Sound effect volume
-Zoom speed
-Display mode

Gameplay: Overhaued 'PP' to 'AP'(action points)
Action points Represents the daily effort a character invests to pursue objectives and lifestyle choices. 
 Action Points are spent on political actions, launching major projects such as constructing space stations or colonizing new worlds, and are also consumed passively by various lifestyles.
 Action points are difficult to cumulate and will decay faster at higher values.

Spacestation building overhaul
-Completely redone the UI/UX for station building
-Redone the station building conditions and constraints
-Many fundamental work on station building logic
-Building a station spends Action Points instead of influence
-The built spacestation is no longer automatically attributed to the initiator of the project


Added dynamic music
Added multiple music tracks, and 'virtual DJ', music adapts dynamically to the mood in the game.

Fixed: Custom system generation sometimes broke

New trait and mechanisms for character : 'Fated'
A new trait, protecting some essential characters and the player from the hammer of RNG, for exemple a fated character will always use the escape pod when his spaceship blows up: 'Protected by destiny, this character always survives events that would claim others.' 

Restored barks (Radio chatter)
Spaceship yell short messages about their emotions, things they are doing etc...

Added disruptor launcher to all frigates

Added 10 closest star system to the prologue scenario

Lua precompilation cache

Tweaked the zoom system to be no longer dependant to timescale

(BETA) UI scaling for all resolutions

Improved strategic view UI, with display mode etc...

UI: Richer description and context menu when allocating or buying an asset

Fixed: Transfering money to an organization was not working
error when registering organization inventory

Fixed: organization's election on policy was not working properly

Added hyperspace drive to Shuttle

New starting background for the prologue

Implemented default doctrine for ship data
Listening post has default military doctrine

Mission UI rework

Added 3 tutorial missions to Prologue

Huge amount of optimization and code quality/structure work
the hidden part that makes up to 50% of this update's workload 

Tons of tweaks and fixes
-> All the undocumented small additions and fixes, there are a lot.

===== [2025-08-24] End of Demo - Demo II Roadmap =====
Demo 1 Wrap-Up

The first public demo wraps up today. This build was primarily a simulation test, bootstrapped with a simple scenario so players could jump in quickly.

From a modest number of playthroughs, most players started with missions, unsurprising in hindsight given the player-centric opening. Unfortunately, missions were the least-tested area , so that path was rougher than intended.

The goal now is to introduce clearer, more recognisable UX patterns for new players while preserving Antimatter’s novel systems.

What’s Next ?
A second version of the demo is scheduled to be released within 2 months, it will include:

 Space station building (commercial and military) (final pass): streamlined UI and full feature set.
 Action menu overhaul: clearer structure, faster access to core actions.
 Major UX/UI pass: richer feedback, revision of the action menu, more actions exposed in the UI, keybinding settings, clearer descriptions, and many small quality-of-life tweaks.
 Tutorials: short videos, in-game text, and custom tutorial missions.
 Audio: sounds and music.
A richer scenario: the scenario system itself was apparently very stable and doesn't require debugging, so I'll add contents, triggers and additional actors.
Depending of the state of the UI and work overhead, potential native compatibility for wide-screen. If this cannot be scheduled for  demo 2, the player will be prompted to switch screen resolution.


Under the Hood

As always, development will also (primarly) continue on deepening the simulation and improving overall code architecture.

Thanks to everyone who tried the demo and shared feedback.

----

Private alpha 
For those having access to the private alpha, your version will be updated tomorrow with the latest  version of the demo. You will be updated with the progress toward v2 of the demo.

===== [2025-08-04] Private Alpha - B0006 (The Giant Update) =====
The Giant UpdateBuild 0006 is ready for the private alpha. If you're part of it, please read the important information at the bottom of this page.This is a massive update, I've estimated that writing a full patch note would take me about two full days of work, which just isn’t worth it.Instead, I'll highlight a few key changes:
Complete rework of the economy/production line simulation and lot of AI (build order, investment behaviour) work plus a complete overhaul of the UI.[img src="{STEAM_CLAN_IMAGE}/38944940/2cc434bb8e313aa659e349de3ec4771dba8c2c7d.png"]Overhauled the trade node simulation.[img src="{STEAM_CLAN_IMAGE}/38944940/6fbb1cf91dcf44eaf9bb21d1bd2769c2e69c1dd1.png"]Full scenario system (with a new playable scenario)[img src="{STEAM_CLAN_IMAGE}/38944940/7b413438639419da9809c7e15591e338b0b1d740.png"]Doctrine/RoE system for spaceship/AI[img src="{STEAM_CLAN_IMAGE}/38944940/fe0f418e91612a45752264cc7190cebeaa40708a.png"]UI/UX rework: numerous tweaks including ship navigation, camera controls, keybindings, RTS-style selection, Time-on-Target orders, queued orders, improved interactions, new interface windows, and much much more.[img src="{STEAM_CLAN_IMAGE}/38944940/28092aeea54a39c9b018ad40fa5c03bbe8d95a9f.png"]Space combat rework:  expanded weapons, reworked all ships, modules, and weapon stats; added many special behaviours; implemented sensor-based missile detection; improved the complex damage model; overhauled planetary bombardment mechanics; added nuclear blast effects (both in space and on the ground), and more.[img src="{STEAM_CLAN_IMAGE}/38944940/3abd09ca346dd420b3eae93ebb86611b51e353f7.png"]Some graphical enhancements: improved gas and dust clouds, orbital bombardment effects, and more.[img src="{STEAM_CLAN_IMAGE}/38944940/22d424ce2c5c965311020f5c32d9ff5980d1cb02.png"]Reworked historical simulationReworked colonization mechanicsImproved atmospheric simulation and accretion model of planetary bodiesMassive improvements to AI and overall performanceBetter performance, improved code maintainability, and reduced code volumeProduction-level Lua support, expanded moddability, and broader localizationCountless bug fixesNumerous tweaks and small feature additions

When starting the prologue : read your in-game mail.
There is a small performance drop (game hangs for 250-500ms) every day passing -> sorry about that, it Will be easily fixed: it is the lua (daily) script methods being recompiled each time instead of being cached virtually during call.WARNING : SAVE/LOAD IS DISABLED FOR THIS BUILDSave/load is currently transitioning to a fully native, serializable data structure (currently 90% of game entities follow this strict structure). Once complete, this will ensure long-term stability and allow future expansions without introducing bugs or extra development overhead.WARNING : MAIN SCENARIO IS DISABLEDThe main game mode is currently disabled to focus development on smaller scenarios, which are used to iterate and test focused gameplay slices more efficiently.

===== [2025-07-08] Industries & Private Alpha Sitrep =====
Hello everyone,It’s been a while, but here’s a sneak peek at part of my recent work:--- PRIVATE ALPHA ---Learning from the lessons of the private alpha, the past month has been spent working on a major update that will introduce a more consolidated version of the game.This includes the usual fundamental work on core features, but also the addition of more comprehensive and streamlined gameplay loops, within a smaller yet denser playground.There’s no new build just yet, I plan to release a new version with these features within the next month.

===== [2025-05-26] Lifeforms =====
For the past two weeks, I’ve been working hard on a major update to the game. However, I still need about another week before it's ready for release to the private alpha and before I can reveal the full scope of this work.

In the meantime, I’ve decided to upload a devlog on a completely different topic: lifeforms. In it, I describe the connection between the agricultural economic sector, lifeforms, and terraformation. Enjoy!



The thumbnail is not misleading, Antimatter is primarly about giant worms and mushrooms, and you have certainly wishlisted the game for these 2 reasons.

===== [2025-05-05] Trade Lines - Version B0004 released (Private Alpha) =====
A new video devlog about the main work of this week :



And a new version was released the 4th of may
---------------------
PRIVATE ALPHA - Update B0004
---------------------
Release Date: 04-05-2025

Focus: Trade AI, UI/UX revision, improved missions, better planet rendering, and essential tweaks and fixes.

Trade Line system + UI/UX
A global system generating and tracking trade lines, used by AIs and the player.

Revised Trade AI
A major change to how trade opportunities are evaluated.

Trade node improvement
Overhauled trade node system to be much more reliable and efficient.

Better UI/UX for trade node
Trade node UI has been reworked entirely, and many tooltips and context menus were implemented.

Reworked and improved passenger transport AI
Passenger transport logic has been reworked for better behavior and planning.

Improved planet rendering
3 new types of forests, 3 new types of mountains, improved forest transitions, and implemented visual assets (added outpost graphics).

Localization: around a hundred new strings
Localization has been expanded with approximately 100 new strings.

Improved save/load with better version tracking/UI
Save/load interface now includes better version tracking and usability.

Sounds effects restored
Previously missing sound effects have been restored.

UI/UX: Added the strategic view
A new strategic view has been added to support large-scale decision-making.

Fixed icon scaling causing object lack visible strategic icons + some improvements on icons and text scaling and performances
Resolved issues with icon scaling and improved performance related to icons and text.

Fixed: Replicant nest generation was not affected by game settings and tweaked generation chances.
Nest generation now respects game settings and generation chances have been adjusted.

Fixed: mushrooms were competing with surface flora reigns, causing them to sometimes take over entire planets.

Impossible to land on planet in some situations
Fixed an issue where landing on planets could become impossible under certain conditions.

Disabled Sol system
The Sol system has been temporarily disabled.

Many fixes and tweaks
A wide range of additional minor fixes and adjustments have been made.

===== [2025-03-02] Ship to Ship Combat (And a bonus !) =====
Hello everyone, enjoy this new video devlog.


Also, you'll notice the solar system being in the game. This is recent work allowing for custom stellar systems (and I have added sol for the example).


Furthermore, it is now possible to define custom height/heat/moisture map for planetary bodies.
Here I have applied an earth heigtmap I found to a random terrestrial planet that ressemble to Earth. But with more work it is possible to get very accurate results !

===== [2025-01-26] New Trailer, Lifeforms & Localization =====
Here’s a new trailer showcasing the progress in 2024, with a click-bait title to lure more poor souls.


Lifeforms


Secondly, I have worked hard on improving terraformation and the simulation of lifeforms.
I have introduced fauna and microorganisms, with special characteristics setting them apart from flora.
Fauna simulates a very basic food-chain system, enhancing the simulation of biodiversity.


The largest improvement is the introduction of a "seed" system, as I call it. It is the strength of introduction of a species on a planet and influences its adaptation score. So now lifeforms are not guaranteed to be present on a viable planet; they have to be introduced. This improves diversity significantly and allows some weaker species to compete and thrive.


Terraformation facilities can therefore be used for both lifeform introduction (or extermination) and atmospheric alterations.

The UI for gases was reworked as well, with a lot of QoL improvements.

Localization
I have initiated localization of the game and about 1500 string keys are bound already. I am glad to say that the game and all mods will be very easy to translate (a single file).
I speak French and can muddle through a bit of English, so both languages are included as core languages.



For the rest of the languages, I wrote a program that automatically translates the game through the GPT API by incorporating already translated languages and context. The more core languages, the better the generated translations will be. I am confident that after some training, most languages will have a proper translation.

The following languages will be supported at release:
French and English as core languages. Chinese, German, Spanish, Italian, Russian, Japanese, and Korean as auto-translated languages, initially.

===== [2024-12-30] 2024 Wrap-Up with Videos ! =====
This is a special update to wrap up the year, with a few thematic videos.

  

  

  

  

I hope you all enjoyed 2024, and I wish you an excellent new year!  

All these videos are used to improve the Steam page quality. I am planning to create at least 5 more videos on different themes. 

Are we there yet?  
(The most asked question)  
No, I am still not confident in having a private alpha yet. As a reminder, this initial alpha will be reserved for the backers of the Kickstarter campaign (hence "private"). There will be no exceptions.  

Obviously, I am not holding a release out of malicious intent or over-cautiousness but because not everything in my professional life is under my strict control, and I have some duties. Additionally, a poorly timed alpha may burden my workload and consume the little free time I have to work on the game (actual dev time - the meat of "work done").  

All I can say is that the game, the software, is in excellent technical shape, and I am very optimistic.  

Bonus  
A discussion on the Discord server pushed me into doing some benchmark tests. Antimatter has seen major code improvements in the past months and optimizations, so I tried some extremes:  

This is a 15,132 stellar systems galaxy (737,252 planetary bodies) with 1,500 years of history simulated, a population of 57T (57,000,000,000,000) humans, and 757 colonized worlds.  
  
It did generate and instantiate fine, but I haven't tried further, and let's be frank, this is probably unplayable.  
It was a nice surprise though, and as a reminder, this isn't merely a usual procedural universe but one painstakingly built through accretion simulation, retained in memory, and continuously simulated! Each of the 757 colonies required a fully generated AND persistently simulated planet surface!!  

On my second test, I tried a galaxy of similar size but with only 100 years of post-Antimatter crisis history.  
  

And it is playable:  
  

Let me get this straight, I am not teasing such a massive playable galaxy here, but that's the fruit of this continuous code structuring labor aimed at getting smooth gameplay, especially late into the game. I expect normal playthroughs to be more within the range of 20-2,000 systems.

===== [2024-12-15] Shipyards =====
Let's do a quick ping on progress. It has already been 2 months since the last devlog, time flies.

The focus lately has been on polishing, with particular attention to code structure and performance improvements.
I have finally reached my performance goal, with drastic improvements by multiple factors, especially for large universes.

While I try to avoid adding new features and focus on wrapping up an alpha, there are still a few outstanding features being added. Here is the tip of the iceberg:

Shipyards and Automation
Queuing orders directly from the military screen instead of micromanaging each shipyard. Shipyards will also attempt to fulfill fleet templates if no specific orders are given.




Improved Production Lines
Production lines have been reworked to make them easier to manage and visualize, supporting batched production versus individual recipes.


Regional Features
Regional features on planets can now be exploited by outposts and cities, providing effects and modifiers.


Surface exploration has become even more important, as these features can yield valuable resources.
Even replicant nests can now be exploited, they produce parts and occasionally replicant spacecrafts.


Personal Finances
New interactions and mechanics for personal finances have been added, including loans.


Boarding & Encounters
Spacecraft can now be boarded, utilizing a party-vs-party combat system.


This system is also used for all forms of dynamic or scripted encounters.



Better Missions Generation
The mission system has been completely revamped, with better generation.


Better UI for the Universe
The UI for universe display has been reworked.

===== [2023-10-28] Planet exploration III =====
This major addition expands the exploration system even further (see [url=https://www.kickstarter.com/projects/geopi/antimatter-a-city-builder-and-4x-game/posts/3287515]planet exploration I and [url=https://www.kickstarter.com/projects/geopi/antimatter-a-city-builder-and-4x-game/posts/3600246]planet exploration II to know more).

I have completed the (massive...) framework and scripting system for encounter and tile features and content-wise, I have decided to complete the first content "arcs" to stress-test it.

 
Regional features



Regional features are persistent points of interest on the planet's surface, they can be visited and have effects on a city, an outpost a region, or an organization. They can also trigger special events, some can be easily discovered (even from orbit)while others need to be found with a land expedition.
 

Built early in reaction to the Urghoghs, these rare and often disabled devices create pocket of developed civilisation.

These are important discoveries as the bonus/malus can be very significant and cumulate across the entire region.
 

A list of regional features present on this planet





Encounters
Additionally, there are non-persistent "encounters" which are contextual events occurring during travels but also as time passes. They can lead to more areas/events and sometimes contain rewards in the form of goods, codex entries, and people to hire. 


This unassuming rock shelter leads to an underground ruined city, this is quite a rare occurrence.

Some action can also be performed, there is a system for crew skill and traits roll and a full range of effects. But for now, there isn't enough content to make very long and engaging adventures.
 

Some valuable industrial machinery and tools were found here.

Currently, there are :

 Rock shelter (and all variants for all climates)
 Stash
 Abandoned Mineshaft
 Worm tunnel
 Aquifer cave
 Fungal cavern
 Magmatic cave

New areas can also be revealed during an encounter if that's allowed by the context, current region, and the planet.

The Future

It is important to have a critical mass of content for all that to become relevant and properly intertwined, so the future content arcs that will be built upon this framework each have a range of encounter and tile features :

 Civilisations remants (Tile feature)
 Crashed spaceships (Dynamic)
 Unique lifeforms and biomes (Tile feature)
 Geological features (Tile feature, partially done)
 Crew and Expedition routine (but I won't include party member buggering you with their life problems)
 Encounters & Combats (using the abstract ground combat system)
 Accidents (chain of decision and skill/trait tests with very limited initiative reserve)
 Planetary and celestial events (Will occur regardless of player's presence)
 Urghogh (dynamic, related to migration/ presence of giant worms)
 


>>> Bonus <<<

Too short to make a devlog, but too significant to skip it :

Landing 
A previous devlog introduced [url=https://www.kickstarter.com/projects/geopi/antimatter-a-city-builder-and-4x-game/posts/3600246]planet exploration, which is now polished.
 


Exploring the planet's surface is necessary to find some type of regional feature, trigger some "encounters" or trade with local populations and nations on the surface. Now scanning the planet from orbit is dangerous due to the replicant's threat, which I will describe later.


Some risks are unknown given the survey level of the region
 
the atmosphere, the relief, flora density, and surface gravity pull are all factors creating more risks to land, while the crew's skill, survey level of a tile, and the presence of a landing pad minimize the risk.
 

This region has been surveyed and the risks are known.

 
There are the following hazards :

 Atmosphere density: during atmospheric entry, the ship's hull is heating and can take damage, this risk is dependent on the ship's hull condition, aerodynamic profile, and the ship's size.
 Relief: chaotic relief and ship size influence the risk.
 Flora density: which also depends on the ship's size.
 Surface gravity: which is influenced by the thrust-to-weight ratio of the ship.


Crew casualties

Now any penetrating damage to a ship (including accidents) will wound and kill crewmembers

===== [2023-10-08] Soot =====
This is a much smaller and light-hearted devlog about nuclear apocalypse :) .



Some context if you've just left your fallout shelter or failed school (or both)

As you may know, humanity recently mastered the atom and weaponized it. Two small, yet conclusive tests were performed on Japanese cities, and despite the military enthusiasm to then use it in bulk, the war ended soon.



The arms race continued, and the accumulated yield of all nuclear weapons reached stunning values that a human mind could barely fathom.

Recent studies estimated that a full-scale nuclear war between Russia (no longer the USSR) and the USA would kill 360 million directly and 5 billion (humans) as a consequence of starvation. A small regional exchange between India and Pakistan would kill about 2 billion. My conclusion is that both scenarios would provoke a significant dent in Antimatter's future player base, which is indeed unfortunate.

So, who is responsible for this astonishing good result in such a macabre endeavor?

Soot

Over decades of studies concluded that accumulation of black carbon soot in the high atmosphere would create a significant obstruction of solar radiation over several years. The consequence would be a sudden drop in surface temperature leading to periods of no-food production and mass extinctions of other species as the dire consequence of a completely fuck-up natural food chain. 



Soot is not only produced by nuclear strikes.  Large fires and volcanoes produce soot as well, the eruption of Mount Tambora in 1815 for example contributed to creating a global cooling.

The condition is to produces a lot in a small area to lift it in the upper atmosphere, so you can already put away this BBQ, it won't solve global warming.

In the game 

As you know Antimatter is a 4X, and I guess that you'd never expect soot to join the arsenal of eXtermination (Actually you probably expected it by now due the the title and previous paragraph...)


We take as subject this nice little planet, teeming with life and love.

I model a complex planet simulation with a great deal of detail, and this, of course, includes the atmosphere. The latest small addition to this equation is soot particles in the high atmosphere.


As you can see this planet had a bumpy road before, the Creator misclicked some buttons, oops. (there was a civilisation here), but now it's all fine.

In Antimatter, soot is particularly effective in reducing the temperature, because it comes first in reflecting the star radiation. Contrary to the effect of albedo that still lets the radiation heat the atmosphere, creating the greenhouse effect and partially bouncing back again, soot blocks radiation right in the upper atmosphere.



This is the effect of 25% of soot just over a few months.

Soot is not something you can't control, (well you can at least add it, obviously), it is produced by volcanic activity and strategic strikes (not yet fully implemented) and it slowly fades after several years.


The effect isn't linear, as secondary effects are also simulated, such as the change in albedo.

The effect of soot is fast, global cooling will occur after the first months.

Since I simulate flora, any change to the climate is likely to create a huge drop in agricultural production, and subsistence production soot also affects solar energy yield. A subsistence economy could theoretically lose the entirety of its food production. 


Grass survived, your lawn is safe, what a relief !

Currently "sun" exposure value for flora is not fully implemented, at this point, the effect of soot will be even more drastic to the biodiversity.

-----

Some stories to tell in order to make your children sleep tight:

https://www.johnstonsarchive.net/nuclear/multimeg.html

https://www.nature.com/articles/s43016-022-00573-0

-----

Disclaimer :

Antimatter is a video game with a relatively complex yet inaccurate, empirical, and unrealistic simulation of telluric planets (in this case). It probably doesn't come close to actual simulations and should not be taken as a serious source for scientific modeling or educational material.

===== [2023-04-17] Station building and colonisation =====
Building space stations
Organizations, including the one controlled by the player, can build space stations anywhere in the galaxy.

The most valued locations to build a production space station are the one in close orbit to the star, as the latter provides essential solar energy. Another significant factor is the relative security of a stellar system, which comes from the police patrols of the controlling organization. Proximity to a large trade hub is often a good condition too.

One must first survey a location and deploy a beacon, the latter will be used for various interactions. In this case, I use it to create a building site.


Deploying a beacon

The builder then must pay upfront a sum to the controlling organization and a monthly fee. Not doing so is considered to be hostile toward the faction. The price is essentially dependant on the proximity to the star.




No fee, but the controlling faction will turn hostile

It might be more profitable to build on the outskirt of a stellar system or in an unclaimed system, however, a feature under development will expand pirate's behaviors, and specifically extorsion, making security a significant factor.

Building a space station is a significant endeavor, and requires a large supply of building materials. A construction site work as a temporary trade node, and traders will supply the station with the necessary goods over time.






An overview of the system

Colonisation
Colonisation was already introduced before as it was already implemented in the "abstract" galactic history generator. Until now, organizations were not expanding after this generation.


A colony ship traveling to a barren planet

If the budget allows it, and if the organisation has the "new worlds" policy enabled, new colonisation projects will emerge. It essentially works like building space station , since colony ships are huge "XXL" sized ships. Therefore a construction site is created around the capital and the ship is slowly built but also supplied with food, water and building materials.


The player gets a mail about any colonisation project, as it represents a profitable opportunity.

Once finished, the ship will pick up settlers at a chosen city and travel to the designated planet to establish a new city.


A new colony on a martian planet



----

This isn't yet the big devlog about cities, but it is coming along. A lot of work is also done on polishing the UI, imroving the AI and patching bugs

===== [2023-01-22] Codex & Technologies [Part I] =====
"Codex" here is a very broad term to designate collective or individual knowledge. It can be either owned by a character, an organization, or a culture.

It can be a map revealing astral objects, a story with useful information for yourself or another character in the game (it unlocks dialogue paths or missions), it can be secrets that can alter the reputation of a character or an organization, and last but not least it can be theoretical sciences, technologies, and designs.



While all the backend programming is done,  I'll only talk here about the first batch of codex entries, for sciences and technologies.

About 70 technologies and theoretical knowledge were added, constituting a full basic tech tree from a primitive era to the spacefaring one.



Codex entries have bonuses and modifiers, which can increase the max possible dev on a tile :



They can allow the construction of buildings, spaceship designs, spaceship modules design, affect the population growth rate, and the administrative capacity.

Some entries also can affect an entire culture or organization, by providing bonus/malus on cohesion or reputation, and can even alter the ethics. 



This is the total bonus of an advanced civilisation :




Codex entries can be found when exploring the galaxy, and it is planned to make it a tradable commodity.

===== [2023-01-16] Devlog : Planet surface =====
I have focused lately on the surface part of the game, the so-called side view of a planet's region, mostly working on the "engine" of this game module rather than the visual stuff, but here are some screenshots, nonetheless.

A region is a single hexagonal tile on the planisphere.

When zooming even more to this tile you will end up in the side view, the flora, fauna, geology, atmospheric conditions and the local civilisations are represented in details. This whole view represents a small significant area of the region.



[url=https://www.kickstarter.com/projects/geopi/antimatter-a-city-builder-and-4x-game/posts/3107522]There are over 100 different species of flora, I simulate a suitability score for each of them to determine which species will win the competition become the dominant ones. 





There are subterranean species as well, in underground biomes, they can be found in seemingly lifeless planets.



Another type of dominant lifeform are the giant worms, I have expanded theirs AI, and the way they grow.



And here is another thriving lifeform, constituting above's luxury desert:



There are hundreds of different buildings, each one has its equivalent in the 5 technological eras : 


  Primitive, comparable to our "stone age".
  "Medieval", encompassing a equivalently broad period of our history.
  Industrial, specifically with the technological advances of the past 2-3 centuries.
  Modern (our own era)
  Spacefaring.

 Of course this doesn't merely change the aesthetics of a civilisation, but this isn't the subject of this devlog. Check this post to know more.

Many buildings are built by the private sector, without the intervention of the player, but some are to be placed manually, or planified.

To those who just discovered the project, here is also a glimpse of the liquid and destruction system :
