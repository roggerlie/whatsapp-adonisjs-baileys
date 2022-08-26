import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class WAController {

    public async index(ctx: HttpContextContract) {

        return ctx.view.render('whatsapp')
    }
}
