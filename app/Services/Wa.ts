import { Boom } from '@hapi/boom'
import makeWASocket, {
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    MessageRetryMap,
    proto,
    useMultiFileAuthState,
    WASocket
} from '@adiwajshing/baileys'
import MAIN_LOGGER from '@adiwajshing/baileys/lib/Utils/logger'
import Botmenu from 'App/Models/Botmenu'
import Usersession from 'App/Models/Usersession'
import { DateTime } from 'luxon'
import Siswa from 'App/Models/jbsakad/Siswa'
import Tagihansiswa from 'App/Models/jbsfina/Tagihansiswa'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'
import Badword from 'App/Models/Badword'

class Wa {

    socket: WASocket

    private async waiting(message: proto.IWebMessageInfo) : Promise<void> {

        await this.socket.presenceSubscribe(message.key.remoteJid!)
        await delay(500)
        await this.socket.sendPresenceUpdate('composing', message.key.remoteJid!)
        await delay(1000)
        await this.socket.sendPresenceUpdate('paused', message.key.remoteJid!)
    }

    public async connect() {

        const sesi = Env.get('WA_SESSION', 'testing')

        const botmenu = await Botmenu.query()
        let arr: string[] = []
        botmenu.forEach((v, k) => {
            arr.push(`${(k+1)}. ${v.info}`)
        })

        arr.push('7. Logout')

        const logger = MAIN_LOGGER.child({})
        logger.level = 'debug'

        const msgRetryCounterMap: MessageRetryMap = {}
        const store = makeInMemoryStore({logger})
        store?.readFromFile('./sessions/'+sesi+'/store.json')

        setInterval(() => {
            store?.writeToFile('./sessions/'+sesi+'/store.json')
        }, 10_000)

        const {state, saveCreds} = await useMultiFileAuthState('sessions/'+sesi)
        const {version, isLatest} = await fetchLatestBaileysVersion()

        console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: true,
            auth: state,
            msgRetryCounterMap,
            browser: ['gupab-bot', 'openSUSE', 'v1.0.0']
        })

        store?.bind(sock.ev)

        this.socket = sock

        setInterval(async () => {

            // console.log('ADD '+DateTime.now().minus({minute: 30}).toFormat('HH:mm'))

            const alluser = await Usersession.query().where('active', 'true')
            if(alluser !== null) {
                alluser.forEach(async v => {

                    const waktumasuk = DateTime.fromFormat(v.jammasukwa, 'HH:mm:ss').plus({minute: 30})
                    const reminder = waktumasuk.minus({minute: 2})

                    const waktusekarang = DateTime.now().toFormat('HH:mm')

                    if(reminder.toFormat('HH:mm') === waktusekarang && v.reminder === 'true') {

                        await sock.sendMessage(`${v.hp}@s.whatsapp.net`, {text: 'apakah kamu masih terhubung ?'})
                        await Usersession.query().where('id', v.id).update({
                            reminder: 'false'
                        })

                    } else if(waktumasuk.toFormat('HH:mm') === waktusekarang) {

                        await sock.sendMessage(`${v.hp}@s.whatsapp.net`, {text: 'sesi berakhir'})
                        await Usersession.query().where('id', v.id).update({
                            active: 'false'
                        })
                    }
                })
            }

        }, 5000)

        sock.ev.process(async (events) => {
    
            if(events['creds.update']) await saveCreds()
    
            if(events['connection.update']) {
                const {connection, lastDisconnect, qr} = events['connection.update']
                switch(connection) {
                    case 'open':
                        console.log('CONNECTED')
                        break
                    case 'close':
                        console.log('CLOSED')
                        if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
                            this.connect()
                        } else {
                            console.log('Connection closed. You are logged out.')
                        }
                        break
                }
    
                if(qr) {
                    console.log(`QRCODE ${qr}`)
                }
            }
    
            if(events['messages.upsert']) {

                
                const messages = events['messages.upsert']
                const message = messages.messages
                await this.socket.readMessages([message[0].key])

                if(messages.type === 'notify') {

                    (await Badword.all()).forEach(async v => {
                        const kj = message[0].message?.conversation?.toLowerCase().includes(v.word)
                        if(kj) return await sock.sendMessage(message[0].key.remoteJid!, {text: 'badword detected'})
                    })

                    const hp = message[0].key.remoteJid?.split('@')[0]
                    const tgl = DateTime.now()

                    const ava = await Usersession.query().where('hp', hp!).first()

                    if(hp === 'status') return
                    // if(hp !== '6281265206860') return

                    if(ava === null) {
                        console.log('Welcome')
                        await this.waiting(message[0])
                        if(ava === null) return
                        await Usersession.create({
                            hp: hp,
                            tanggalmasukwa: tgl
                        }).finally(async () => {
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'Terima kasih telah menghubungi Perguruan Panca Budi. Silakan ketik "Menu" untuk Informasi Administrasi Keuangan Sekolah'})
                            return
                        })
                        
                    } else {

                        await Usersession.query().where('hp', hp!).update({
                            jammasukwa: tgl.toFormat('HH:mm:ss')
                        })

                        // console.log("SAME OR NOT "+tgl.toISODate(), ava.tanggalmasukwa.toISODate())
                        if(ava.tanggalmasukwa === null || tgl.toISODate() !== ava.tanggalmasukwa?.toISODate()) {
                            await Usersession.query().where('hp', hp!).update({
                                tanggalmasukwa: tgl.toISODate(),
                                active: 'false'
                            }).finally(async () => {
                                await sock.sendMessage(message[0].key.remoteJid!, {text: 'Terima kasih telah menghubungi Perguruan Panca Budi. Silakan ketik "Menu" untuk Informasi Administrasi Keuangan Sekolah'})
                                return
                            })
                        }
                    }
                    
                    const ceksesi = await Usersession.query()
                    .where('hp', hp!).where('tanggalmasukwa', tgl.toISODate())
                    .where('active', 'true')
                    .first()

                    if(message[0].message?.conversation === '7') {
                        await Usersession.query().where('hp', hp!).update({
                            tanggalmasukwa: null,
                            jammasukwa: null,
                            active: 'false',
                            reminder: 'false'
                        }).finally(async () => {
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'berhasil logout'})
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'terima kasih sudah menggunakan layanan ini ...'})
                            return
                        })
                    }
                    
                    if(message[0].message?.conversation?.match(/menu/i)) {
                        await this.waiting(message[0])
                        await sock.sendMessage(message[0].key.remoteJid!, {text: 'Informasi pembayaran administrasi sekolah perguruan panca budi \n\n'+arr.join('\r\n')})
                    }

                    if(message[0].message?.conversation?.match(/^[1-6]{1}$/i)) {

                        await this.waiting(message[0])
                        if(ceksesi === null) {
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'masukkan nama nis dulu ya ...'})
                            return
                        }

                        const cek = await Botmenu.find(message[0].message.conversation)

                        if(cek?.isimage === 'true') {
                            // await sock.sendMessage(message[0].key.remoteJid!, {text: 'please wait ...'})
                            // const drive = Drive.list('.')
                            // const folder = await drive.toArray()
                            // folder.forEach(async v => {

                            //     const image = await Drive.get(v.location)
                            //     await sock.sendMessage(message[0].key.remoteJid!, {image: image})
                            // })
                            await sock.sendMessage(message[0].key.remoteJid!, {text: cek?.reply!})
                        }

                        if(cek?.isaskdb === 'true') {
                            if(cek.command === 'infotagihan') {
                                const tagihan = await Tagihansiswa.query()
                                .select(Database.rawQuery('*, SUM(tagihanjumlah) AS totaltagihan'))
                                .where('tagihansiswaid', ceksesi.noreg)
                                .where('tagihanperiode', DateTime.now().year)
                                .groupBy('tagihantermin')
                                .sum('tagihanjumlah')
                                
                                const tm: string[] = []
                                tm.push('Termin Total Status')
                                tagihan.forEach(v => {
                                    tm.push(`${v.tagihantermin} ${v.$extras.totaltagihan} ${v.tagihanaktif === '1' ? 'belum' : 'lunas'}`)
                                })
                                await sock.sendMessage(message[0].key.remoteJid!, {text: `Noreg ${ceksesi.noreg}\nNama ${ceksesi.nama}\n${tm.join('\r\n')}`})
                            }

                            if(cek.command === 'inforincian') {
                                const tagihand = await Tagihansiswa.query()
                                .select(Database.rawQuery('tagihantermin, tagihanperiode, SUM(tagihanjumlah) as total, GROUP_CONCAT((SELECT nmbiaya FROM tagihan_jenis_biaya WHERE kdbiaya = tagihanKodeBiaya), " ", tagihanjumlah SEPARATOR "\n") as biaya'))
                                .where('tagihansiswaid', ceksesi.noreg)
                                .where('tagihanperiode', DateTime.now().year)
                                .where('tagihanaktif', '1')
                                .groupBy('tagihantermin')
                                .first()

                                if(tagihand === null) {
                                    await sock.sendMessage(message[0].key.remoteJid!, {text: 'Tidak ada tagihan periode '+DateTime.now().year})
                                    return
                                }

                                await sock.sendMessage(message[0].key.remoteJid!, {text: `Noreg ${ceksesi.noreg}\nTagihan Periode ${tagihand?.$extras.tagihanperiode}\nTagihan Termin ${tagihand?.$extras.tagihantermin}\n${tagihand?.$extras.biaya}\n------------------------------------------------\nTotal ${tagihand?.$extras.total}`})
                            }
                        }

                        if(cek?.isimage === 'false' && cek.isaskdb === 'false') {

                            if(cek.command === 'infogabung') {

                                const ganti = cek.reply.replace(/#/g, '⭐')
                                await sock.sendMessage(message[0].key.remoteJid!, {
                                    text: ganti
                                })

                            } else {

                                const cp: 
                                {
                                    [P in '01' | '06' | '02' | '03' | '05']: 
                                    {nama: string, jabatan: string, nohp: string}[]
                                } = {
                                    '01': [
                                        {nama: 'Susiani', jabatan: 'WKS', nohp: '081264737606'},
                                        {nama: 'Djairida', jabatan: 'WKS', nohp: '082274069292'}
                                    ],
                                    '06': [
                                        {nama: 'Sudirman', jabatan: 'WKS', nohp: '082277639688'},
                                        {nama: 'Musdiyanto', jabatan: 'WKS', nohp: '082272940616'}
                                    ],
                                    '02': [
                                        {nama: 'Ermayadi', jabatan: 'WKS', nohp: '082366307460'},
                                        {nama: 'Apri', jabatan: 'WKS', nohp: '082296003390'}
                                    ],
                                    '03': [
                                        {nama: 'Susanti', jabatan: 'WKS', nohp: '082272940631'},
                                        {nama: 'Adlin', jabatan: 'WKS', nohp: '08126417103'}
                                    ],
                                    '05': [
                                        {nama: 'Hariyanti', jabatan: 'WKS', nohp: '085297351824'},
                                        {nama: 'Ferdinand', jabatan: 'WKS', nohp: '082275000378'}
                                    ]
                                }

                                const cpkepsek = cp[ceksesi.noreg.substring(0, 2)]
                                
                                let arrt: string[] = []
                                cpkepsek.forEach((v: { nama: string, nohp: string }) => arrt.push(`${v.nama} ${v.nohp}`))

                                let pesan: string 
                                if(cek.command === 'infopelunasan') pesan = cek.reply
                                else pesan = `${cek.reply}\n${arrt.join('\r\n')}`
                                
                                await sock.sendMessage(message[0].key.remoteJid!, {
                                    text: pesan
                                })
                            }
                        }
                    }

                    // if(message[0].message?.conversation?.match(/^([0-9]{2}).([\.0-9]{2,8})$/i) && ceksesi === null) {
                    if(message[0].message?.conversation?.match(/^\w+( \w+)*\s([0-9]{2}).([\.0-9]{2,8})$/i) && ceksesi === null) {

                        const nr = await Usersession.query().where('hp', hp!).first()
                        const nisnama = message[0].message.conversation.split(' ')

                        let like: string
                        let ns: string
                        if(nisnama.length === 3) {
                            like = nisnama[0]+' '+nisnama[1]
                            ns = nisnama[2]

                        } else {
                            like = nisnama[0]
                            ns = nisnama[1]
                        }
                        const ceknama = await Siswa.query()
                        .whereRaw(`LEFT(noun, 2) = ${nr?.noreg.substring(0, 2)}`)
                        .whereILike('nama', `%${like}%`)
                        .first()
                        
                        if(ceknama === null) {
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'nama tidak ditemukan !'})
                            return 
                        }

                        const siswa = await Siswa.query()
                        .where('nis', ns)
                        .first()

                        if(siswa === null) {
                            await sock.sendMessage(message[0].key.remoteJid!, {text: 'nis tidak ditemukan !'})
                            return 
                        }
                        
                        await sock.sendMessage(message[0].key.remoteJid!, {text: 'selamat datang '+ siswa.nama})

                        await Usersession.query()
                        .where('hp', hp!)
                        .update({
                            nis: siswa.nis,
                            noreg: siswa.noreg,
                            nama: siswa.nama,
                            jammasukwa: tgl.toFormat('HH:mm:ss'),
                            active: true,
                            reminder: true
                        }).finally(async () => await sock.sendMessage(message[0].key.remoteJid!, {
                            text: 'Informasi pembayaran administrasi sekolah perguruan panca budi \n\n'+arr.join('\r\n')
                        }))

                    }
                }
            }
        })
        
    }

    public async sendMessage(image: Buffer) {

        // const drive = Drive.list('.')
        // ;(await drive.toArray()).forEach(async (v, k) => {
        //     console.log(v.location)
        //     await this.socket.sendMessage('6281265206860@s.whatsapp.net', {
        //         image: {buffer: Drive.get(v.original)}
        //     })
        // })
        console.log(image)
        await this.socket.sendMessage('6281265206860@s.whatsapp.net', {
            image: image
        })
    }
}

export default new Wa()