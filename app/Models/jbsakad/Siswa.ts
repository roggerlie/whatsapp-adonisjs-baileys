import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Siswa extends BaseModel {

  public static connection = 'jbsakad'
  public static table = 'siswa'

  @column({ isPrimary: true })
  public replid: number

  @column()
  public nis: string

  @column({columnName: 'noun'})
  public noreg: string

  @column()
  public nama: string

}
