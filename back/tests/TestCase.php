<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // En environnement de test, diriger la connexion heap_monitoring vers la connexion par défaut (:memory:)
        config([
            'database.connections.heap_monitoring' => config('database.connections.' . config('database.default'))
        ]);
    }
}
