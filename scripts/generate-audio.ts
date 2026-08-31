/**
 * Quick script to generate audio from an existing story using Dia TTS
 */

import { generateDialogue, isDiaAvailable } from '../src/lib/dia'
import * as fs from 'fs/promises'
import * as path from 'path'

const STORY_SCRIPT = `
In the world of battle rap, what started as online beef between a league owner and a blogger exploded into real violence on a rainy night in Connecticut. Two grown men in their 40s, one running a female battle rap league, the other known for controversial hot takes, would turn a celebration into chaos. This is the story of how words became fists, and how battle rap's behind-the-scenes drama spilled into the streets.

To understand this story, you need to know the players. Debo is the co-founder and CEO of Queen of the Ring, or QOTR, a prominent female battle rap league. She's a businesswoman from the Bronx who's built her reputation promoting women in a male-dominated culture. As one observer noted, "One thing about Bronx, you can't sleep on the people from the Bronx, man."

On the other side is Caps, also known as AngryFan007, who runs Angry Fans Radio. He's a blogger and commentator known for his critical hot takes about the battle rap scene. Caps has a physical disability, a visibly impaired arm that limits his mobility. As one witness described, "We clearly see that he got one arm. Like, he got two arms, but one of them is stripped, like, messed up."

The tension between these two had been building online, with Caps making critical commentary about Debo and her league on his platform. Battle rap in 2024 had become, as one observer put it, "literally a sitcom," full of drama and personal conflicts that played out publicly.

The night of November, QB Black Diamond was hosting her "Ready to Die" event in Connecticut. It was supposed to be a celebration. As QB Black Diamond herself described it: "The battles were going smoothly, whole night, all night. Everything. Good vibes. Nobody was hungry, nobody was thirsty, it was weed, it was everything. We leave with Connecticut. So it was a good vibe."

But Caps was there, and according to multiple witnesses, he'd been drinking. As he later admitted on a live stream: "I was kind of drunk. I ain't gonna lie. But I didn't mess up the event."

Then Debo arrived. According to Caps, speaking on PIPERBOY WILLIAMS' platform immediately after the incident: "I was at the QB event. Shout out to everybody who was there. Everybody seen me that was in the crowd. And this person stole off me out of nowhere. And when I was out there by the door, he stole me."

Caps was adamant about what happened: "I didn't stumble, I didn't fall. It was nothing like that. My punk hit me and then ran out the side door." He emphasized that Debo caught him completely off guard: "I didn't even know he was even there. I was there chilling the whole time. So that means you was laying the cut watching me."

The punch landed, but according to Caps, it didn't have the intended effect: "It didn't even hurt that bad. And you said people had their cameras out." What happened next was chaos.

Caps' reaction was immediate and explosive. As he described it: "I started bugging the out, wiling, and to the point they calling the police on me. Cause I was doing too much. They were saying the security was throwing me out and all this. And it was raining."

The scene outside became chaotic. Multiple witnesses confirmed Caps was "wilding" in the rain, trying to get back into the venue. "They throwing me out in the rain and looking for my car and all kinds of crazy. And I didn't give a damn with my car because I was wild."

Security footage captured by Uncle Rod and others shows Caps in the rain, his pants falling down, clearly agitated and trying to get back inside the building. As one blogger noted while reviewing the footage: "Why his pants falling down and all of that? What is going on here?"

Event host QB Black Diamond was not pleased with how her event was disrupted: "Another league owner comes in my event and pops on somebody. That ain't okay. I done spent thousands and thousands, thousands of my dollars. You know better. You know what I'm saying? You know better."

She acknowledged her own past but emphasized the difference: "I done did some things in my time. But I was young, like I was a kid. And acting off emotion when I was a kid. Now I am who I am. But right now we too grown and old for that. Come on, man."

The battle rap community's reaction was swift and divided. Some criticized Debo for allegedly targeting someone with a disability. As one commentator noted: "First of all, Caps is handicapped. So he's handicapped in an actual fight."

Others pointed to Caps' reputation for controversial statements. As someone familiar with both parties observed: "Caps be talking crazy a lot of times, so y'all gotta know that that is liable. It could happen, man."

Vada Fly, a prominent battle rap blogger, captured the community's mixed reaction: "Debo punched somebody that has one arm. I don't know all of the logistics of it. Caps is disabled, per se. What I'm hearing is Debo snuff caps."

The Debo vs Caps fight represents a troubling escalation in battle rap's ongoing drama. Two middle-aged adults, both public figures in their community, let online tensions explode into real-world violence at someone else's event.

Caps ended up soaked in the rain, his dignity as damaged as his clothes, while Debo disappeared into the night, leaving others to deal with the aftermath of her actions. QB Black Diamond's successful event was overshadowed by drama that had nothing to do with her or her battlers.

The incident raises uncomfortable questions about accountability in battle rap culture. When does criticism become harassment? When does being "from the Bronx" or having a tough reputation excuse assault? And what happens to a community when its adults can't model better behavior than the young battlers they're supposed to guide?

As the battle rap community continues to grapple with these questions, one thing remains clear: the night Debo and Caps let their online beef turn physical, nobody won. In a culture built on the power of words, sometimes the most damaging battles happen when the talking stops and the real violence begins.

The rain that night washed away more than just dignity. It exposed the ugly reality of what battle rap becomes when grown folks refuse to act grown.
`

async function main() {
  const available = await isDiaAvailable()
  if (!available) {
    console.error('Dia TTS service is not running. Start with: npm run dia:up')
    process.exit(1)
  }

  console.log('Generating audio for Debo vs Caps story via Dia TTS...')
  console.log(`Script length: ${STORY_SCRIPT.length} characters`)

  // Clean script for TTS
  const cleanScript = STORY_SCRIPT
    .replace(/^#.+$/gm, '')
    .replace(/\[.+?\]/g, '')
    .replace(/\*\*/g, '')
    .trim()

  try {
    const audioBuffer = await generateDialogue({
      segments: [{ speaker: 1, text: cleanScript }],
      seed: 42
    })

    // Save to file
    const outputDir = path.join(process.cwd(), 'public', 'audio')
    await fs.mkdir(outputDir, { recursive: true })

    const filename = `debo-vs-caps-${Date.now()}.mp3`
    const audioPath = path.join(outputDir, filename)

    await fs.writeFile(audioPath, audioBuffer)

    console.log(`Audio saved to: ${audioPath}`)
    console.log(`URL: /audio/${filename}`)
  } catch (error) {
    console.error('Failed to generate audio:', error)
    process.exit(1)
  }
}

main()
