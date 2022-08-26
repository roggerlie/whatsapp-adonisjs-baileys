import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Tagihansiswa extends BaseModel {

  public static connection = 'jbsfina'
  public static table = 'tagihan_siswa'

  @column({ isPrimary: true, columnName: 'tagihanId' })
  public tagihanid: number
  
  @column({ columnName: 'tagihanSiswaId' })
  public tagihansiswaid: string
  
  @column({ columnName: 'tagihanPeriode' })
  public tagihanperiode: string
  
  @column({ columnName: 'tagihanTermin' })
  public tagihantermin: string

  @column({ columnName: 'tagihanKodeBiaya' })
  public tagihankodebiaya: string
  
  @column({ columnName: 'tagihanJumlah' })
  public tagihanjumlah: string
  
  @column({ columnName: 'tagihanAktif' })
  public tagihanaktif: string


}
