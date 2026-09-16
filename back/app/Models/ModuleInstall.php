<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

/**
 * ModuleInstall — Adaptateur lecture seule vers la table `module_installs`
 * gérée par le serveur Express (SpiderHome Fleet Monitor).
 *
 * ⚠️  READ-ONLY : aucune écriture autorisée via ce modèle.
 *      Toute tentative de save() / create() / update() lèvera une exception.
 *
 * Connexion : heap_monitoring (DB_HEAP_*)
 * Table     : module_installs
 */
class ModuleInstall extends Model
{
    // ──────────────────────────────────────────────
    // Connexion dédiée (base SpiderHome Express)
    // ──────────────────────────────────────────────
    protected $connection = 'heap_monitoring';
    protected $table      = 'module_installs';

    public function getConnectionName()
    {
        return app()->environment('testing') ? config('database.default') : $this->connection;
    }

    // La table gère son propre `timestamp`, pas les colonnes Laravel.
    public $timestamps = false;

    // ──────────────────────────────────────────────
    // Cast des colonnes
    // ──────────────────────────────────────────────
    protected $casts = [
        'id'         => 'integer',
        'timestamp'  => 'datetime',
        'uptime_ms'  => 'integer',
    ];

    // Colonnes exposables (lecture seule)
    protected $visible = [
        'id', 'timestamp',
        'device', 'device_name',
        'firmware', 'mac',
        'supla_server', 'email',
        'uptime_ms', 'reason',
    ];

    // ──────────────────────────────────────────────
    // Protection en écriture
    // ──────────────────────────────────────────────
    protected $guarded = ['*'];

    /**
     * Lève une exception si quelqu'un tente d'écrire via ce modèle.
     */
    public static function boot(): void
    {
        parent::boot();

        $reject = fn() => throw new \LogicException(
            'ModuleInstall est en lecture seule — les écritures sont interdites.'
        );

        static::creating($reject);
        static::updating($reject);
        static::deleting($reject);
    }

    // ──────────────────────────────────────────────
    // Scopes de filtrage
    // ──────────────────────────────────────────────

    /** Filtre par device identifier. */
    public function scopeForDevice(Builder $q, string $device): Builder
    {
        return $q->where('device', $device)
                 ->orWhere('device_name', $device);
    }

    /** Filtre par adresse e-mail du client. */
    public function scopeForEmail(Builder $q, string $email): Builder
    {
        return $q->where('email', $email);
    }

    /** Filtre par adresse MAC. */
    public function scopeForMac(Builder $q, string $mac): Builder
    {
        return $q->where('mac', $mac);
    }

    /** Filtre par version firmware. */
    public function scopeForFirmware(Builder $q, string $firmware): Builder
    {
        return $q->where('firmware', 'like', "%{$firmware}%");
    }

    /** Installations récentes (dernières N heures). */
    public function scopeLastHours(Builder $q, int $hours = 24): Builder
    {
        return $q->where('timestamp', '>=', now()->subHours($hours));
    }
}
