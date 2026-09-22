// The teacher's guide ("Guia del professorat"): every part and option of the
// game, in Catalan. Static text, shown from ⚙ Professorat and from the home page.

const SECTIONS = [
  {
    id: 'comencar',
    icon: '🚀',
    title: 'Per començar',
    html: `
      <h4>Obrir el joc</h4>
      <ul>
        <li>Fes doble clic a <b>Obre Rockin (Mac)</b> o <b>Obre Rockin (Windows)</b>, dins la carpeta del joc. S'obre una finestra negra (el «servidor») i el navegador amb el joc. <b>No tanquis la finestra negra</b> mentre jugueu.</li>
        <li>Si ja hi havia una altra còpia oberta, el joc fa servir una altra adreça (8081, 8082…): sempre veus la còpia que acabes d'obrir.</li>
        <li>A la portada, sota els botons, hi ha la <b>versió</b>. Si no és la que esperes, tanca totes les finestres negres i torna-ho a obrir.</li>
        <li>Fes servir <b>Chrome</b> o <b>Edge</b> (Safari no reconeix els teclats MIDI). Cal connexió a internet (so i música de fons).</li>
        <li>Mac: si diu que no tens permisos, obre el Terminal, escriu <code>chmod +x </code>, arrossega-hi el fitxer i prem Retorn.</li>
      </ul>
      <h4>Amb què es toca</h4>
      <ul>
        <li><b>Teclat MIDI</b> connectat per USB: el reconeix sol (Chrome o Edge).</li>
        <li><b>Ratolí o dit</b> sobre el piano de la pantalla.</li>
        <li><b>Teclat de l'ordinador</b>: activa <b>«Tocar amb l'ordinador»</b> a dalt de tot. Surten les lletres a les tecles (<kbd>A</kbd> = Do). Per defecte està desactivat perquè les lletres no distreguin.</li>
        <li><b>«Sentir les meves notes»</b>: el programa fa sonar el que es toca (desactiva-ho si el teclat MIDI ja sona pel seu compte).</li>
      </ul>
      <h4>La portada</h4>
      <ul>
        <li><b>Juga</b>: el joc guiat per als alumnes (camí, camí intel·ligent i taller d'acords).</li>
        <li><b>Cançons</b>: camins per a cada cançó (les del llibre ROCKIN, cançons conegudes i les que creeu).</li>
        <li><b>Toca amb la banda</b>: per als alumnes, posar-ho tot a prova tocant sense parar; la dificultat s'adapta.</li>
        <li><b>Sessió</b>: per treballar a classe amb qualsevol progressió i totes les opcions.</li>
      </ul>`,
  },
  {
    id: 'alumnes',
    icon: '🧑‍🎓',
    title: 'Alumnes i primera vegada',
    html: `
      <ul>
        <li><b>Qui juga?</b> Cada alumne escriu el seu nom (o el tria de la llista). Diversos alumnes poden compartir ordinador: cadascú té el seu progrés. «No ets…? Canvia» (al peu del mapa) torna a la llista.</li>
        <li>La primera vegada surten <b>5 pantalles de benvinguda</b>: la carta diu <i>quan</i> tocar, el teclat <i>quines</i> notes, primer s'escolta i després es toca, i les estrelles. «❓ Com es juga?» les torna a mostrar.</li>
        <li>Després, <b>Amb quantes mans vols tocar?</b> (vegeu <a data-go="mans">Una mà o dues</a>).</li>
        <li>Finalment, <b>Per on comences?</b> «Comença pel principi» o la <b>🎯 prova de nivell</b>.</li>
      </ul>
      <h4>Prova de nivell</h4>
      <p>Quatre proves curtes que s'aturen a la primera que no se supera. L'alumne comença just allà; els mons d'abans queden oberts per repassar.</p>
      <ol>
        <li><b>Ritme</b>: tocar el Do seguint una carta amb música (75% de compassos nets).</li>
        <li><b>Acords</b>: construir Do, Sol, La m i Fa sense ajuda (3 de 4 sense errors).</li>
        <li><b>Canvis</b>: la roda Do–Sol–La m–Fa–Do acord per acord, sense ajuda (com a molt 1 errada).</li>
        <li><b>La roda amb cartes</b>: dues cartes amb música, sense ajuda al teclat (75%).</li>
      </ol>
      <p>La prova es fa amb una mà. El resultat surt a la zona del professorat.</p>`,
  },
  {
    id: 'cami',
    icon: '🎸',
    title: 'El camí (Juga)',
    html: `
      <p>El mapa mostra una salutació, les estrelles, un botó gran <b>▶ Juga</b> amb la missió següent i els mons: l'actual obert, els acabats amb ✓ i els següents tancats amb 🔒. <b>Una estrella</b> obre la missió següent.</p>
      <h4>Els sis mons</h4>
      <ol>
        <li><b>Llegeix les cartes</b>: lliçó i cartes sobre una sola nota (Do).</li>
        <li><b>Aprèn la roda</b> (Do – Sol – La m – Fa): cada acord, cada canvi, la roda pas a pas, la roda amb música i l'objectiu de memòria.</li>
        <li><b>La roda amb ritme</b>: cartes diferents sobre la roda, l'objectiu (tres cartes seguides) i tocar amb la banda.</li>
        <li><b>Cançons i estructura</b>: progressions de cançons conegudes i estrofa + tornada.</li>
        <li><b>Temps partits</b>: cartes amb rodones partides.</li>
        <li><b>Inversions</b>: moure menys la mà entre acords.</li>
      </ol>
      <h4>🎯 Prova de nivell</h4>
      <p>Quatre proves curtes (ritme, acords, canvis i la roda amb cartes) que porten qui juga al punt que li toca. Va tota sola: cada prova comença sola i, quan acaba, passa a la següent. A la barra hi ha <b>↩ Prova anterior</b>, <b>⏭ Salta la prova</b> i <b>▶ Comença aquí</b> (atura la prova i comença a jugar en aquest punt).</p>

      <h4>Cartes difícils: les mans alternades</h4>
      <p>Les cartes amb el pols partit en quatre només es fan servir <b>amb dues mans</b>: amb una sola mà són massa subdivisió i acaben tensant el braç. Aquestes cartes es dibuixen en <b>una sola fila</b> amb els colors intercalats: cada tros <b style="color:#3fb2f5">blau</b> el toca la dreta i cada tros <b style="color:#ff8a2a">taronja</b>, l'esquerra, una darrere l'altra dins del mateix temps (com el patró de merengue). Amb una sola mà, el camí intel·ligent s'atura a les cartes intermèdies.</p>

      <h4>El nivell, sempre a la vista</h4>
      <p>Durant les missions, a la barra de dalt hi ha <b>«El teu nivell»</b> (de 0 a 6) amb el nom del nivell. Clicant-lo s'obre l'escala sencera: què es podria fer amb el grup a cada nivell, quins ja estan fets i <b>què falta</b> per al següent. La prova de nivell també hi compta: si et fa començar més endavant, el nivell ja surt pujat.</p>

      <h4>🃏 Estudia una carta</h4>
      <p>Sota les missions de cada món hi ha totes les seves <b>cartes</b>. Clicant-ne una s'obre una pràctica lliure d'aquella carta sola, amb les tecles pintades i sense guardar estrelles: serveix per treballar un contorn melòdic o un ritme concret tantes vegades com calgui.</p>

      <h4>Els suports visuals es retiren sols</h4>
      <p>A mesura que puja el <b>nivell de banda</b>, el joc treu ajudes: a partir del nivell 3 (de memòria) la <b>imatge del teclat</b> desapareix a les missions que no pinten tecles, i les cartes es fan més grosses; a partir del nivell 4, quan tota una volta de la roda es toca amb <b>la mateixa carta</b>, se'n mostra <b>una de sola</b>: al costat hi ha la <b>roda sencera</b> amb els acords en ordre i el que sona encès, i l'etiqueta diu «una carta · acord 2 de 4», així es veu quant queda per tocar. Sempre es pot recuperar el teclat amb el botó <b>🎹</b> de la barra de dalt.</p>

      <h4>Pantalla completa</h4>
      <p>A Juga, el botó <b>⛶ Pantalla completa</b> (o la tecla <b>F</b>) deixa només la carta, el teclat i una línia de text; Espai i Esc continuen funcionant i el joc segueix avançant sol, així una sessió de classe va gairebé sense ratolí. Hi entra <b>tot el joc</b>, també el mapa i els menús, de manera que el ratolí continua funcionant si surts de la missió. Esc en surt.</p>

      <h4>Tot cap a la pantalla</h4>
      <p>La mida de les cartes s'ajusta al que hi ha: es fan <b>més petites o més grans</b> perquè hi càpiguen totes sense haver de fer scroll, sempre amb <b>la mateixa proporció</b> (no es retalla res). Quan cada fila és una sola carta (la roda tocada amb una carta), les files es posen <b>una al costat de l'altra</b>, així es veu d'un cop tot el que s'ha de tocar.</p>

      <h4>La banda</h4>
      <p>La base la toquen bateria, baix, guitarra i piano. El <b>piano queda enrere</b> (només marca l'acord als temps forts) i la <b>guitarra</b> fa els contratemps, els rasgueigs i els skanks; cada quatre compassos la bateria fa un <b>petit fill</b> i el compàs següent obre amb plat. El <b>clic de metrònom mentre es toca està desactivat</b> (la bateria ja marca el pols); només se sent el compte enrere d'entrada. Es pot tornar a activar a ⚙ Professorat → Opcions del joc. El compte enrere entre missions també <b>sona</b>.</p>

      <h4>Els estils de la base</h4>
      <p>N'hi ha <b>tretze</b> més el metrònom: rock/pop, blues shuffle, balada, swing, bossa nova, funk, reggaeton, reggae, rumba catalana i, nous, <b>ska</b>, <b>cúmbia</b>, <b>hip-hop</b> i <b>vals</b> (aquest, pensat per al 3/4). Cada estil varia cada dos compassos (obertures de charles, notes fantasma, el baix que puja a la cinquena) i les intensitats tenen un petit moviment perquè no soni de màquina.</p>

      <h4>Nivells de banda: què podries fer amb els companys</h4>
      <p>Al mapa de Juga hi ha una fitxa que tradueix el progrés en una cosa concreta: <b>què es podria fer ara mateix tocant amb un grup</b>. Puja sola quan se supera una missió del tipus corresponent i, quan puja, ho diu a la pantalla de resultats.</p>
      <ol start="0">
        <li><b>Comences</b>: trobar les notes al teclat.</li>
        <li><b>Acords, amb temps per pensar</b>: fer tots els acords si els companys t'esperen entre canvi i canvi.</li>
        <li><b>Canvis fluids</b>: seguir la roda sense que ningú t'esperi.</li>
        <li><b>Patrons amb les cartes</b>: acompanyar amb ritmes diferents mirant les cartes.</li>
        <li><b>Sense suport visual</b>: acompanyar de memòria, mirant els companys.</li>
        <li><b>Toques amb la banda</b>: una cançó sencera sense parar; si t'equivoques, tornes a entrar.</li>
        <li><b>Tries i combines</b>: tries els patrons a cada moment i els combines (arpegis, contorn melòdic, dues mans).</li>
      </ol>

      <h4>Quan només es toca una nota</h4>
      <p>Al nivell 1 (una sola nota, per exemple el Do), si la progressió és sempre el mateix acord la <b>banda es mou</b>: toca <b>I – vi – IV – V</b> de la mateixa tonalitat (Do – La m – Fa – Sol), de manera que la nota que es manté encaixa amb tots els acords i l'estona no es fa pesada. Cada quatre compassos el baix fa una pujada cap a l'acord següent i, de tant en tant, la guitarra hi posa un petit adorn.</p>
      <p>Quan només s'escolta <b>una carta</b> abans de tocar, el compàs d'entrada el fa la <b>dominant</b> (el V), de manera que entres resolent a la tònica en comptes de sentir el mateix acord dues vegades. Quan s'escolta la roda sencera, l'últim compàs de la roda ja fa d'entrada.</p>

      <h4>El joc va sol</h4>
      <p>Hi ha pocs clics: cada missió <b>comença tota sola</b> al cap d'uns segons (el compte surt a la pantalla; «▶ Comença ara» o Espai ho fa anar de seguida, i qualsevol botó atura el compte). Quan una missió se supera, la següent s'obre sola; quan no, es torna a provar sola. <b>Si t'equivoques, t'ajuda</b>: el proper intent va més lent i, si calia, les tecles s'il·luminen. <b>Si t'en surts, es complica</b>: torna el tempo normal i desapareix l'ajuda del teclat.</p>
      <p>Entre repte i repte la <b>banda continua tocant</b> de fons mentre el joc demana el següent. Es pot aturar amb el botó <b>♫ Banda entre reptes</b> de la barra de la missió (es recorda).</p>
      <p>A la barra de cada missió hi ha sempre <b>↩ Anterior</b> i <b>⏭ Salta</b>: no cal superar una missió per passar endavant o tornar enrere.</p>
      <p>Quan escoltes l'exemple, l'<b>últim compàs de l'exemple ja fa de compte enrere</b> (hi sona el clic i diu «Ara tu!»): no s'afegeix cap compàs extra.</p>

      <h4>⭐ Nivell 2: arpegis i contorn melòdic</h4>
      <p>Quan s'acaba el camí (també el de cada cançó) s'obre el nivell 2, amb les <b>cartes melòdiques</b>: punts units per una línia; cada punt és una nota de l'acord, tocada d'una en una. Si la línia puja, la nota és més aguda; si baixa, més greu; a la mateixa altura, la mateixa nota. Qualsevol nota de l'acord val si segueix la línia: es pot començar per qualsevol nota (qualsevol inversió). Les cartes melòdiques no marquen ritme; al joc, perquè es puguin escoltar i tocar amb la banda, les notes van sobre un pols constant: 2 notes, una cada mig compàs; 3–4 notes, una per temps; 5–8 notes, una per mig temps (l'última sona fins al final del compàs). La pilota bota sempre almenys a cada temps.</p>
      <ol start="7">
        <li><b>Arpegis</b>: lliçó de les cartes de línia, <b>la roda nota a nota</b> (fonamental, tercera i quinta, primer amb la tecla que toca pintada i després de memòria; el joc espera), cartes de <b>dues notes</b> (amunt-avall, avall-amunt, repetides), la primera de tres notes i l'objectiu.</li>
        <li><b>Contorn melòdic</b>: cartes de <b>tres notes</b> (avall, amunt, que tornen) i, al final, de <b>quatre</b>; l'objectiu i la banda.</li>
      </ol>
      <p>Amb ajuda, el teclat pinta les notes de l'acord <b>sense números</b> (els números es reserven per als dits i els graus). A la demostració, les tecles s'il·luminen amb el <b>color del grau</b> de l'acord, i així es veu que les notes van juntes per acords. Una X amb ↕ vol dir que la nota no anava cap on marca la línia. El nivell 2 es toca amb la mà dreta, encara que s'hagin triat dues mans.</p>
      <h4>Tipus de missions</h4>
      <ul>
        <li><b>Lliçó</b>: pantalles amb una carta d'exemple (es pot escoltar).</li>
        <li><b>Acord nou</b>: mirar-lo i escoltar-lo, construir-lo comptant tecles des de la fonamental (4 i 3 per als majors, 3 i 4 per als menors; els números apareixen a les tecles), i tocar-lo pintat i de memòria. La fonamental ha d'anar a baix. <b>Pistes quan s'equivoca</b>: mentre el construeix, cada nota equivocada diu quina ha tocat i, a la segona errada, pinta la fonamental; els salts es compten amb números a les tecles. De memòria, cada errada recorda les tres notes (p. ex. «Sol – Si – Re») i, a la segona, es pinten les tecles (compta com a pista: 2 estrelles). També hi ha el botó «Pista».</li>
        <li><b>Canvi</b>: un <b>diagrama</b> amb fletxes (vegeu <a data-go="canvis">Canvis d'acord</a>) i una animació al teclat; després, anar i tornar entre els dos acords. <b>El joc espera</b> fins que l'acord és correcte.</li>
        <li><b>Pas a pas</b>: la roda dues vegades, la primera amb les tecles pintades i la segona de memòria. El joc espera a cada acord; només es pinta l'acord que toca en aquell moment. Hi ha un botó «Pista».</li>
        <li><b>Ritme, Objectiu, Cançó, Estructura</b>: amb música. Primer el piano toca la roda (cartes amb una <b>mà ✋</b>: escoltar sense tocar), després surt «Ara tu!» amb el compte, i es toca. La pilota bota de rodona en rodona.</li>
        <li>Quan una missió només té <b>una roda</b>, es toca <b>dues vegades</b> sobre les mateixes cartes (la fila porta «×2» i diu si és la 1a o la 2a volta).</li>
        <li><b>Banda</b>: la música no s'atura i no hi ha exemple. Si t'equivoques, tornes a entrar a la carta següent.</li>
        <li><b>Inversions</b>: construir les tres posicions d'un acord.</li>
      </ul>
      <h4>Estrelles i dificultat</h4>
      <ul>
        <li>Missions amb música: 3 estrelles si tots els compassos són nets, 2 amb el 85%, 1 amb el 75% (Banda: 90%, 75% i 60%).</li>
        <li><b>Tempo adaptatiu</b>: si surten menys de la meitat de compassos nets, el següent intent va 8 pulsacions més lent (fins a −24); un intent perfecte el torna a pujar. Amb el tempo rebaixat, com a molt 2 estrelles.</li>
        <li>Missions on el joc espera: 3 estrelles sense errades, 2 amb una o dues errades o pistes, 1 amb més.</li>
        <li>Després dels objectius, cançons i banda, surt una pregunta curta: <b>on has perdut el fil</b> (canvis, ritme, notes, el fil, cap problema). Ho veureu a la zona del professorat.</li>
      </ul>
      <h4>Les marques de les cartes</h4>
      <ul>
        <li>Punt <b style="color:#1f9d55">verd</b>: ben tocat (a l'esquerra de la rodona, avançat; a la dreta, endarrerit).</li>
        <li><b style="color:#d64545">X</b> amb nom: nota que no és de l'acord. X sense nom: tocat on no tocava.</li>
        <li>Cercle <b style="color:#d64545">vermell</b>: rodona sense tocar. Cercle <b style="color:#f08a00">taronja</b>: acord incomplet («falta Mi»).</li>
        <li><b style="color:#d64545">~</b>: la nota sonava durant un silenci (cal aixecar el dit).</li>
        <li><b style="color:#d64545">X «mantén!»</b>: a una <b>barra</b> (nota llarga) s'han aixecat les tecles abans d'hora; cal mantenir-les fins al final.</li>
        <li>El resultat dona consells (per exemple, «tens tendència a avançar-te»).</li>
      </ul>
      <p><b>Tecles</b>: <kbd>Espai</kbd> comença, pausa o passa a la següent; <kbd>Esc</kbd> atura o torna al mapa.</p>`,
  },
  {
    id: 'mans',
    icon: '🙌',
    title: 'Una mà o dues',
    html: `
      <p>Cada alumne tria al principi com vol tocar. Es pot canviar quan es vulgui amb el botó <b>«Toques amb … · Canvia»</b> del mapa.</p>
      <ul>
        <li><b>✋ Una mà</b>: la dreta toca els acords.</li>
        <li><b>🙌 Dues mans, el mateix acord</b>: l'esquerra fa el mateix acord, una octava més avall.</li>
        <li><b>🙌 Dues mans, l'esquerra fa el baix</b>: la dreta fa l'acord i l'esquerra només la nota de baix del mateix acord.</li>
      </ul>
      <p>Amb dues mans el camí és el mateix (fins i tot la banda), però:</p>
      <ul>
        <li>Les cartes tenen <b>dues files</b>: la <b style="color:#3fb2f5">blava</b> per a la mà dreta i la <b style="color:#ff8a2a">taronja</b> per a l'esquerra. Les notes llargues són una barra del mateix gruix que les rodones, com a les cartes impreses (turquesa a la fila blava, taronja fosc a la taronja).</li>
        <li>El teclat mostra més tecles: les de la dreta en blau i les de l'esquerra en taronja, amb els números dels dits (1-3-5 i 5-3-1).</li>
        <li>El joc considera <b>mà esquerra tot el que es toca per sota del Do central</b>, i dreta del Do central cap amunt.</li>
        <li>Cada mà es corregeix per separat: les marques de la dreta surten a sobre de la fila blava i les de l'esquerra, a sota de la taronja. Un compàs només és net si ho són les dues mans.</li>
        <li>A «Llegeix les cartes», les dues mans toquen la fonamental.</li>
        <li>Construir acords, els canvis i les inversions s'ensenyen amb la mà dreta.</li>
        <li>Amb l'esquerra al baix, al final hi ha un món més, <b>Cadascuna el seu ritme</b>, amb cartes on cada mà té un ritme diferent (una i una, esquerra primer, rock, reggae, balada), i un altre, <b>Dues mans: ritmes difícils</b>, amb temps partits: primer a una sola mà (contratemps, corxeres, pop, galop, bossa, funk) i després a <b>les dues mans amb ritmes diferents</b> (contratemps creuats, funk, galop i rumba creuats). A «Toca amb la banda», amb l'esquerra al baix, els nivells intermedis i difícils fan servir aquestes cartes.</li>
        <li>Les estrelles es guarden a part per a cada manera de tocar.</li>
      </ul>`,
  },
  {
    id: 'intelligent',
    icon: '🧭',
    title: 'Camí intel·ligent',
    html: `
      <p>Segona pestanya del mapa de Juga i del mapa de cada cançó. Treballa els mateixos aprenentatges que el camí, però <b>sense un ordre fix</b>: el joc va provant què se sap i tria el repte següent.</p>
      <p>Durant els reptes, a la barra de dalt hi ha sempre <b>↩ Més fàcil</b> (baixa una etapa), <b>⏭ Salta</b> (passa endavant i deixa aquest repte per a més tard) i <b>🧭 El meu camí</b> (surt al mapa de coneixements): no es queda mai tancat dins la roda d'avaluació.</p>
      <h4>Els aprenentatges (per etapes)</h4>
      <ol>
        <li>Les notes de la roda · llegir cartes</li>
        <li>Cada acord</li>
        <li>Cada canvi entre acords</li>
        <li>La roda a tempo</li>
        <li>Un acord a cada temps</li>
        <li>Silencis · notes llargues</li>
        <li>Cartes seguides</li>
        <li>Amb la banda</li>
        <li>Cartes intermèdies (el temps partit en dos)</li>
        <li>Cartes difícils (subdivisions més petites)</li>
        <li>Arpegis (cartes melòdiques)</li>
        <li>Contorn melòdic</li>
      </ol>
      <p>Les cartes de ritme es van complicant: quan les fàcils surten bé, passa a les intermèdies i després a les difícils. Cada vegada que torna a un aprenentatge fa servir cartes diferents.</p>
      <h4>Com decideix</h4>
      <ul>
        <li>Comença per baix i <b>salta ràpid</b>: cada repte ben fet puja una etapa, i una ratxa de reptes bons en puja <b>dues o tres de cop</b>. A la barra de dalt hi diu sempre en quin <b>nivell</b> està (per exemple «Nivell 5/12 · Silencis i notes llargues») i, quan puja, el resultat ho diu.</li>
        <li>Per sota del nivell on ja és, <b>no torna a demanar</b> el que ja sap: només hi torna si una cosa falla clarament.</li>
        <li>Si un repte d'una etapa alta surt bé, dona per sabut el que hi ha per sota (surt amb vora de punts: «deduït»).</li>
        <li>Si surt malament, torna a provar el que havia deduït de les dues etapes anteriors.</li>
        <li>Amb música, detecta en quin acord o canvi hi ha hagut notes equivocades i ho marca per practicar.</li>
        <li>Si falla els canvis, primer comprova els acords i després practica només els canvis que costen.</li>
        <li>Si una cosa falla tres vegades, l'aparca: canvia d'activitat i hi torna més tard (i no proposa res més difícil mentre hi ha coses aparcades).</li>
        <li>Tocar bé les cartes melòdiques no dona per sabudes les cartes de ritme difícils.</li>
      </ul>
      <h4>La pantalla</h4>
      <ul>
        <li>El proper repte amb el motiu i <b>▶ Juga</b>.</li>
        <li>El mapa «Què saps»: <b style="color:#3ddc84">verd</b> ho sap, verd de punts deduït, <b style="color:#ffa24c">taronja</b> cal practicar, gris per provar. Clicant qualsevol aprenentatge es practica.</li>
        <li>Després de cada repte: «Següent repte →» i una línia amb el que ha canviat.</li>
        <li>«↺ Torna a començar» esborra el que el camí sap de cada persona.</li>
        <li>No dona estrelles. Una mà i dues mans es porten a part.</li>
      </ul>`,
  },
  {
    id: 'taller',
    icon: '🎹',
    title: "Taller d'acords",
    html: `
      <p>Tercera pestanya de Juga. Jocs curts, sempre oberts, amb una pregunta gran i poc text:</p>
      <ul>
        <li><b>Troba la nota</b>: tecles blanques amb nom, sense nom i tecles negres. Després de dues errades es pinten.</li>
        <li><b>Salta tecles</b>: des d'una tecla groga, saltar 1–4 tecles (els números apareixen un a un).</li>
        <li><b>Construeix</b>: acords majors, menors i barrejats. Guiat (fonamental → primer salt → segon salt → les tres alhora) o sol, amb el botó «Ajuda pas a pas».</li>
        <li><b>Contra rellotge</b>: tants acords com es pugui en 60 segons (3, 6 i 10 per a 1, 2 i 3 estrelles).</li>
      </ul>`,
  },
  {
    id: 'cancons',
    icon: '📖',
    title: 'Cançons',
    html: `
      <ul>
        <li><b>Cançons del llibre ROCKIN</b>: Corren, De Bonesh, Diamonds, En la tormenta, Flor de primavera, Me gustas tú, Sense tu, Som ocells i Urras, amb la tonalitat, l'estil, el tempo i l'estructura del llibre (sense lletres). A Sense tu, la tornada canvia d'acord cada dos temps al llibre; al joc cada acord dura un compàs.</li>
        <li><b>Cançons conegudes</b>: un clic crea el camí d'aquella progressió.</li>
        <li><b>+ Crea un camí</b>: nom, roda d'acords (escrita o d'una cançó coneguda), tornada opcional, transport a una altra tonalitat, compàs (4/4, 3/4, 6/8, 12/8), estil de la base, tempo i si comença llegint cartes. Els camins creats surten com a targetes amb ✕ per esborrar-los.</li>
      </ul>
      <h4>El mapa d'una cançó</h4>
      <ul>
        <li>Pestanyes: <b>El camí</b> i <b>Camí intel·ligent</b>. «🖨 Fitxa» imprimeix la fitxa de la cançó.</li>
        <li>Les cançons del llibre mostren <b>la graella</b>: una fila per part, amb els acords pintats pel seu grau.</li>
        <li>Els mons: aprendre la roda (cada acord i cada canvi), la roda amb ritme, la cançó (acords o canvis nous de les altres parts, «La part X pas a pas» i <b>La cançó sencera</b> amb totes les parts en ordre) i les inversions.</li>
        <li><b>🔓 Desbloqueja-ho tot</b> (a la llista i als mapes): entra en mode professor per provar tots els camins.</li>
      </ul>`,
  },
  {
    id: 'banda',
    icon: '🎤',
    title: 'Toca amb la banda',
    html: `
      <p>Porta de la portada per als alumnes: el lloc on es posa tot a prova. L'alumne tria una cançó (la roda ROCKIN, les del llibre o els camins creats) i toca amb la banda <b>sense parar</b>.</p>
      <ul>
        <li>Es toca per <b>tandes</b> de quatre cartes (una per volta de la roda). Entre tanda i tanda hi ha 4 segons per mirar les marques; després la banda torna a començar sola.</li>
        <li>Amb el <b>85%</b> de compassos nets es puja de nivell; per sota del <b>60%</b> es baixa.</li>
        <li>Nivells: 1–2 cartes fàcils (primer més lent), 3–5 cartes intermèdies (més lent, normal, més ràpid), 6–8 cartes difícils (fins a «Mestre de la banda»). El tempo parteix del de la cançó (entre 60 i 126).</li>
        <li>Les cartes de cada tanda són a l'atzar dins del nivell.</li>
        <li>Es toca amb una mà o dues, segons el que s'hagi triat.</li>
        <li>El joc recorda per a cada cançó el nivell on es va quedar (la propera vegada hi comença) i el <b>rècord</b>. «■ Atura» mostra el resum de la sessió.</li>
        <li>A la zona del professorat, a la taula del camí ROCKIN (o de la cançó), surt com «Toca amb la banda (nivell més alt)».</li>
      </ul>`,
  },
  {
    id: 'improvisa',
    icon: '✨',
    title: 'Improvisa',
    html: `
      <p>Quarta porta de la portada. Aquí no hi ha cartes, ni estrelles, ni correccions: la banda toca una roda i qui juga hi inventa a sobre. Serveix per perdre la por a tocar sense partitura i per escoltar-se.</p>
      <h4>Tres maneres</h4>
      <ul>
        <li><b>Roda oberta</b>: la banda no para; s'hi toca el que es vulgui fins que es prem <b>Prou, ja he acabat</b>.</li>
        <li><b>Pregunta i resposta</b>: durant mitja roda el piano fa una pregunta (una frase pentatònica, sempre diferent, que acaba en suspens) i l'altra mitja contesta qui juga. Es pot imitar o canviar.</li>
        <li><b>Reptes</b>: una consigna cada vegada (només tres notes, una frase que pugi, deixa un compàs de silenci, entra a contratemps, acaba en nota de l'acord…). No s'acaba sol: <b>🎲 Un altre repte</b> diu com ha anat i en porta un de nou, i <b>Prou, ja he acabat</b> tanca amb el resum.</li>
      </ul>
      <h4>La roda</h4>
      <p><b>✏️ Inventa la teva roda</b>: s'hi escriuen els acords (Do, La m, Si♭… o C, Am, Bb…) o s'afegeixen amb els botons, amb l'estil i el tempo, i ja es pot improvisar a sobre. També hi surten la roda de ROCKIN, les cançons del llibre i els camins creats a Cançons.</p>
      <h4>Què marca el teclat</h4>
      <ul>
        <li><b>Notes de l'acord</b>: les tres notes del que sona ara.</li>
        <li><b>Pentatònica</b>: cinc notes fixes per a tota la roda (les de l'acord, plenes).</li>
        <li><b>Escala sencera</b>: les set notes de la tonalitat.</li>
        <li><b>Res marcat</b>: el teclat no diu res i es toca d'oïda.</li>
      </ul>
      <h4>Què diu al final</h4>
      <p>Un resum en paraules, mai una nota ni estrelles: quantes notes s'han tocat i quantes diferents, quina part eren de l'acord que sonava, si el ritme ha estat variat i si s'ha deixat algún compàs de silenci, amb una idea per a la pròxima vegada. La roda pot ser la de ROCKIN o la de qualsevol cançó del llibre o pròpia, amb el seu estil i el seu tempo.</p>`,
  },
  {
    id: 'colors',
    icon: '🎨',
    title: 'Colors i graus dels acords',
    html: `
      <p>Com al llibre (sistema Hooktheory), cada acord té el color del seu grau dins la tonalitat:</p>
      <p class="guide-degrees">
        <span style="background:#ec1c24;color:#fff">I</span>
        <span style="background:#f7a21b">ii</span>
        <span style="background:#f5e616">iii</span>
        <span style="background:#3fd11a">IV</span>
        <span style="background:#4b52f5;color:#fff">V</span>
        <span style="background:#9d3fe3;color:#fff">vi</span>
        <span style="background:#f2459a">vii°</span>
        <span style="background:#f3b3ef">♭VII…</span>
      </p>
      <ul>
        <li>En tonalitat menor es fan servir els colors de la relativa major: el i és lila, el iv taronja, el VII blau…</li>
        <li>Els acords de fora de la tonalitat (com el ♭VII de Flor de primavera) són rosa clar.</li>
        <li>Majúscula = acord major; minúscula = menor.</li>
        <li>Surten a les etiquetes dels acords, a sobre de cada carta i a la fitxa. Cada mapa té un apartat plegable, «🎨 Els colors dels acords», amb les funcions: <b>tònica</b> (I, vi, iii), <b>predominant</b> (IV, ii) i <b>dominant</b> (V, vii°).</li>
        <li>Als camins que creeu, la tonalitat és la del primer acord.</li>
      </ul>`,
  },
  {
    id: 'canvis',
    icon: '↷',
    title: "Canvis d'acord",
    html: `
      <p>A les missions de canvi i a la fitxa, el canvi es mostra amb un <b>diagrama</b>:</p>
      <ul>
        <li>Punts de baix: els dits de l'acord d'ara. Punts de dalt: on han d'anar. Cada punt porta el número del dit i el color del seu acord.</li>
        <li>Una <b>fletxa</b> va de cada dit a la seva tecla nova.</li>
        <li>📌 marca el dit que no es mou; les tecles verdes són als dos acords.</li>
        <li>Si tota la mà es desplaça igual, surt una fletxa gran amb ✋.</li>
        <li>L'explicació amb paraules queda plegada a «Explica-m'ho amb paraules».</li>
      </ul>`,
  },
  {
    id: 'professorat',
    icon: '⚙',
    title: 'Zona del professorat',
    html: `
      <p>Al peu del mapa de Juga: <b>⚙ Professorat</b>.</p>
      <ul>
        <li><b>🔓 Mode professor</b>: un perfil «Professor/a» amb tot obert (camí, taller i cançons) que no guarda estrelles ni intents. Se'n surt amb «Surt del mode professor».</li>
        <li><b>Fitxa per imprimir</b>: una pàgina A4 horitzontal amb la roda, l'estructura, cada acord en un tecladet amb els dits, els canvis amb diagrames, les inversions, les cartes i una llista per revisar abans de tocar en grup. La de cada cançó és al seu mapa.</li>
        <li><b>Velocitat</b> (lenta, normal, ràpida): el tempo de les missions; els tempos de les cançons s'hi ajusten.</li>
        <li><b>Metrònom</b> mentre toquen.</li>
        <li><b>Noms de les notes</b> a les tecles.</li>
        <li><b>Obre totes les missions a tots els alumnes</b>.</li>
        <li><b>Números de dit a les tecles pintades</b>: apagat per defecte (els números es poden confondre amb els graus). Si s'encén, surt una <b>taula de digitacions</b> amb tots els acords del joc: cada acord es pot deixar en automàtic (el número gris) o escriure-hi la digitació que vulgueu, de la nota més greu a la més aguda i per a la <b>mà dreta</b> (per exemple Si♭ = 1-2-4); l'esquerra la fa a l'inrevés.</li>
        <li><b>Camí intel·ligent</b>: què sap cada persona, què ha de practicar i quants reptes ha fet.</li>
        <li><b>Progrés</b> de cada camí (una taula per camí): estrelles, barra per món, intents, últim dia, missions que costen (3 intents o més amb 1 estrella o menys), què diuen a l'autoavaluació i el resultat de la prova de nivell. Clicant un alumne es veuen els seus últims 20 intents. Es pot canviar el nom, esborrar-lo i <b>descarregar un CSV</b>.</li>
      </ul>
      <h4>On es guarden les dades</h4>
      <ul>
        <li>Tot es guarda <b>al navegador d'aquest ordinador</b>. Cada ordinador (i cada navegador) té els seus alumnes.</li>
        <li>Si s'esborren les dades de navegació, es perd el progrés. Descarregueu el CSV de tant en tant.</li>
      </ul>`,
  },
  {
    id: 'sessio',
    icon: '🎛',
    title: 'Sessió (classe)',
    html: `
      <p>Des de la portada, <b>Sessió</b>. Pensat per al professorat i la classe, amb totes les opcions:</p>
      <ul>
        <li><b>Progressió d'acords</b>: clicar acords, triar una progressió preparada o una <b>cançó coneguda</b> (s'hi posa l'estil i el tempo), a qualsevol tonalitat. «Edita com a text»: <code>C | Am | F | G</code> (<code>%</code> repeteix el compàs).</li>
        <li><b>Compàs i tempo</b>: 4/4, 3/4, 6/8, 9/8, 12/8 i els polsos per minut.</li>
        <li><b>Base musical</b>: estil (rock/pop, blues shuffle, balada, swing, bossa nova, funk, reggaeton, reggae, rumba catalana, ska, cúmbia, hip-hop, vals i només metrònom), volum, <b>sincronia</b> (si la música sona tard, per exemple amb auriculars Bluetooth) i piano amb els acords.</li>
        <li><b>Joc</b>: joc lliure (cartes a l'atzar) o repte carta a carta. <b>Què toques</b>: 1 ritme + fonamental, 2 ritme + tríada, 3 contorn melòdic, 4 baix + acord (dues mans). Per tocar amb dues mans com a Juga: <b>5</b> les dues mans el mateix acord, <b>6</b> l'esquerra fa el baix (totes dues amb les cartes de dues files, blava per a la dreta i taronja per a l'esquerra) i <b>7</b> cada mà el seu ritme (les cartes de dues mans, només en 4/4); per sota del Do central és la mà esquerra. Al teclat, les notes que arriben tenen el color de les rodones de la carta: <b style="color:#3fb2f5">blau</b> per a la mà dreta i <b style="color:#ff8a2a">taronja</b> per a l'esquerra; a la carta, els punts de pulsació de la dreta surten a sobre de la fila blava i els de l'esquerra, a sota de la taronja. Dificultat de les cartes, quan surt una carta nova, <b>ajuda al teclat</b> (notes que arriben, cartes al piano roll —experimental—, només les tecles, només la carta) i inversions.</li>
        <li><b>Camí de reptes</b> amb el seu progrés (i «Esborra el progrés») i el <b>repte final</b>. Si una carta no surt, <b>⏭ Salta aquesta carta</b> (també mentre es toca) obre la següent; la saltada queda amb la vora discontínua i ⏭, i es pot superar més tard. Quan totes les cartes d'una dificultat estan superades o saltades s'obre el repte final.</li>
        <li>Mentre es toca, la carta mostra les <b>correccions com a Juga</b>: creu vermella i nom de la nota equivocada o fora de temps, cercle vermell si falta, taronja si l'acord és incomplet (amb les notes que falten), ~ si calia silenci i «mantén!» si la nota llarga s'ha deixat anar abans. Amb dues mans, les marques de la dreta surten a sobre i les de l'esquerra, a sota.</li>
        <li>Botons: ▶ Comença, ■ Atura, ♪ Escolta la carta, ⛶ Pantalla completa, ↕ teclat vertical.</li>
        <li><b>Notes i acords</b> (pestanya de dalt): explicacions i minijocs per trobar notes i construir acords.</li>
      </ul>`,
  },
  {
    id: 'problemes',
    icon: '🛟',
    title: 'Si alguna cosa no va',
    html: `
      <ul>
        <li><b>No veig els canvis nous</b>: mira la versió a la portada. Tanca totes les finestres negres i torna a obrir el joc des de la carpeta bona (no des d'una còpia antiga).</li>
        <li><b>No sona</b>: clica qualsevol botó de la pàgina (el navegador demana un clic abans de fer sonar res) i comprova el volum.</li>
        <li><b>El teclat MIDI no respon</b>: fes servir Chrome o Edge, connecta'l abans d'obrir la pàgina i accepta el permís de MIDI.</li>
        <li><b>La música va desfasada</b>: a Sessió, puja la «Sincronia».</li>
        <li><b>Una franja vermella a baix</b>: és un error. Recarrega la pàgina (Cmd+Shift+R o Ctrl+Shift+R) i, si torna, envia'n el text.</li>
      </ul>`,
  },
];

/** The guide, as a DOM element. `button(label, onClick, kind)` makes the game's buttons. */
export function renderGuide({ button, onBack, onPrint }) {
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(Boolean));
    return node;
  };
  const sections = SECTIONS.map((s) =>
    el('section', { className: 'play-world guide-section', id: `guia-${s.id}` }, [
      el('h3', { textContent: `${s.icon} ${s.title}` }),
      el('div', { className: 'guide-body', innerHTML: s.html }),
    ]),
  );
  const jump = (id) => document.getElementById(`guia-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toc = el('nav', { className: 'guide-toc' }, SECTIONS.map((s) => {
    const b = el('button', { type: 'button', className: 'play-chip', textContent: `${s.icon} ${s.title}` });
    b.addEventListener('click', () => jump(s.id));
    return b;
  }));
  const root = el('div', { className: 'guide' }, [
    el('div', { className: 'play-teacher-top' }, [
      onBack ? button('← Torna', onBack, 'ghost') : null,
      el('h2', { textContent: '📘 Guia del professorat' }),
      onPrint ? button('🖨 Imprimeix la guia', onPrint, 'ghost small') : null,
    ]),
    el('p', { className: 'play-note', textContent: 'Totes les parts i opcions del joc. Els alumnes no la necessiten: el joc els guia pas a pas.' }),
    toc,
    ...sections,
  ]);
  root.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-go]');
    if (!link) return;
    event.preventDefault();
    jump(link.dataset.go);
  });
  return root;
}

/** A plain copy of the guide for printing. */
export function renderGuidePrint() {
  const box = document.createElement('div');
  box.className = 'print-guide';
  box.innerHTML = `<h1>ROCKIN · Guia del professorat</h1>${SECTIONS.map((s) => `<section><h2>${s.icon} ${s.title}</h2>${s.html}</section>`).join('')}`;
  return box;
}
